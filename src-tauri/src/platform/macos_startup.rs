use std::path::{Path, PathBuf};
use crate::error::AppError;
use crate::models::StartupItem;

// ─────────────────────────────────────────
// Plist parsing
// ─────────────────────────────────────────

struct PlistInfo {
    label: Option<String>,
    program: Option<String>,
    program_arguments: Option<Vec<String>>,
    run_at_load: Option<bool>,
    keep_alive: Option<bool>,
    keep_alive_successful_exit: Option<bool>,
    disabled: Option<bool>,
}

/// Parse a .plist file and extract only startup-relevant keys.
fn parse_plist(path: &Path) -> Option<PlistInfo> {
    let value: plist::Value = plist::Value::from_file(path).ok()?;
    let dict = value.as_dictionary()?;

    let label = dict.get("Label").and_then(|v| v.as_string().map(String::from));

    let program = dict
        .get("Program")
        .and_then(|v| v.as_string().map(String::from));

    let program_arguments = dict.get("ProgramArguments").and_then(|v| {
        v.as_array().map(|arr| {
            arr.iter()
                .filter_map(|a| a.as_string().map(String::from))
                .collect()
        })
    });

    let run_at_load = dict.get("RunAtLoad").and_then(|v| v.as_boolean());

    let keep_alive = match dict.get("KeepAlive") {
        Some(plist::Value::Boolean(b)) => Some(*b),
        Some(plist::Value::Dictionary(d)) => {
            // KeepAlive as a dict — check for SuccessfulExit
            d.get("SuccessfulExit")
                .and_then(|v| v.as_boolean())
                .or(Some(true))
        }
        _ => None,
    };

    let keep_alive_successful_exit = match dict.get("KeepAlive") {
        Some(plist::Value::Dictionary(d)) => {
            d.get("SuccessfulExit").and_then(|v| v.as_boolean())
        }
        _ => None,
    };

    let disabled = dict.get("Disabled").and_then(|v| v.as_boolean());

    Some(PlistInfo {
        label,
        program,
        program_arguments,
        run_at_load,
        keep_alive,
        keep_alive_successful_exit,
        disabled,
    })
}

/// Returns true if this LaunchAgent/Daemon actually auto-starts.
fn is_startup_relevant(info: &PlistInfo) -> bool {
    if info.run_at_load == Some(true) {
        return true;
    }
    if info.keep_alive == Some(true) {
        return true;
    }
    if info.keep_alive_successful_exit == Some(false) {
        return true;
    }
    false
}

fn percent_decode(raw: &str) -> String {
    let mut result = String::with_capacity(raw.len());
    let mut chars = raw.chars();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if hex.len() == 2 {
                if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                    result.push(byte as char);
                    continue;
                }
            }
            result.push('%');
            result.push_str(&hex);
        } else {
            result.push(c);
        }
    }
    result
}

// ─────────────────────────────────────────
// BTM database
// ─────────────────────────────────────────

#[derive(Debug)]
struct BtmEntry {
    name: Option<String>,
    entry_type: String,
    identifier: String,
    url: Option<String>,
    enabled: bool,
    executable_path: Option<String>,
    developer_name: Option<String>,
}

/// Run `sfltool dumpbtm` and parse the text output into BTM entries.
fn parse_btm_entries() -> Vec<BtmEntry> {
    let output = match std::process::Command::new("/usr/bin/sfltool")
        .arg("dumpbtm")
        .output()
    {
        Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).to_string(),
        _ => {
            log::warn!("sfltool dumpbtm failed — skipping BTM items");
            return Vec::new();
        }
    };

    parse_btm_text(&output)
}

fn parse_btm_text(text: &str) -> Vec<BtmEntry> {
    let mut entries = Vec::new();
    let mut current: Option<BtmEntryBuilder> = None;

    for line in text.lines() {
        let trimmed = line.trim();

        // Detect start of a new item block
        if trimmed.starts_with('#') && trimmed.contains(':') {
            // Save previous entry if there is one
            if let Some(builder) = current.take() {
                if let Some(entry) = builder.build() {
                    entries.push(entry);
                }
            }
            continue;
        }

        // Key-value lines
        if let Some(builder) = &mut current {
            let kv: Vec<&str> = trimmed.splitn(2, ':').collect();
            if kv.len() != 2 {
                continue;
            }
            let key = kv[0].trim();
            let value = kv[1].trim();

            match key {
                "Name" => {
                    let name = value.strip_suffix("(null)").or(Some(value)).unwrap_or("").trim();
                    if !name.is_empty() && name != "(null)" {
                        builder.name = Some(name.to_string());
                    }
                }
                "Developer Name" => {
                    if value != "(null)" {
                        builder.developer_name = Some(value.to_string());
                    }
                }
                "Type" => {
                    builder.entry_type = classify_btm_type(value);
                }
                "Identifier" => {
                    builder.identifier = Some(value.to_string());
                }
                    "URL" => {
                        if value != "(null)" {
                            // Strip file:// prefix
                            let path = percent_decode(
                                value.strip_prefix("file://").unwrap_or(value)
                            );
                            builder.url = Some(path);
                        }
                    }
                    "Disposition" => {
                        builder.enabled = value.contains("enabled");
                    }
                    "Executable Path" => {
                        builder.executable_path = Some(value.to_string());
                    }
                    _ => {}
                }
            } else {
                // Start a new entry when we see the first key
                current = Some(BtmEntryBuilder::default());
                // Re-process this line
                let kv: Vec<&str> = trimmed.splitn(2, ':').collect();
                if kv.len() == 2 {
                    let key = kv[0].trim();
                    let value = kv[1].trim();

                    let builder = current.as_mut().unwrap();
                    match key {
                        "Name" => {
                            let name = value.strip_suffix("(null)").or(Some(value)).unwrap_or("").trim();
                            if !name.is_empty() && name != "(null)" {
                                builder.name = Some(name.to_string());
                            }
                        }
                        "Type" => { builder.entry_type = classify_btm_type(value); }
                        "Identifier" => { builder.identifier = Some(value.to_string()); }
                        "URL" => {
                            if value != "(null)" {
                                let path = percent_decode(
                                    value.strip_prefix("file://").unwrap_or(value)
                                );
                                builder.url = Some(path);
                            }
                        }
                        "Disposition" => { builder.enabled = value.contains("enabled"); }
                        "Executable Path" => { builder.executable_path = Some(value.to_string()); }
                        "Developer Name" => {
                            if value != "(null)" {
                                builder.developer_name = Some(value.to_string());
                            }
                        }
                        _ => {}
                    }
                }
        }
    }

    // Save the last entry
    if let Some(builder) = current {
        if let Some(entry) = builder.build() {
            entries.push(entry);
        }
    }

    entries
}

#[derive(Default)]
struct BtmEntryBuilder {
    name: Option<String>,
    entry_type: String,
    identifier: Option<String>,
    url: Option<String>,
    enabled: bool,
    executable_path: Option<String>,
    developer_name: Option<String>,
}

impl BtmEntryBuilder {
    fn build(self) -> Option<BtmEntry> {
        let identifier = self.identifier?;
        Some(BtmEntry {
            name: self.name,
            entry_type: self.entry_type,
            identifier,
            url: self.url,
            enabled: self.enabled,
            executable_path: self.executable_path,
            developer_name: self.developer_name,
        })
    }
}

fn classify_btm_type(raw: &str) -> String {
    if raw.contains("developer") || raw.contains("0x20") {
        "btm_developer".into()
    } else if raw.contains("daemon") || raw.contains("0x10") {
        "btm_daemon".into()
    } else if raw.contains("app") || raw.contains("0x2") {
        "btm_app".into()
    } else {
        "btm_developer".into()
    }
}

// ─────────────────────────────────────────
// App bundle scanning
// ─────────────────────────────────────────

fn scan_app_bundle_plists(items: &mut Vec<StartupItem>) {
    let app_dirs = [
        PathBuf::from("/Applications"),
    ];

    for app_dir in &app_dirs {
        if !app_dir.exists() {
            continue;
        }
        let Ok(read) = std::fs::read_dir(app_dir) else { continue };
        for entry in read.flatten() {
            let app_path = entry.path();
            if app_path.extension().and_then(|e| e.to_str()) != Some("app") {
                continue;
            }

            let launch_agents = app_path.join("Contents/Library/LaunchAgents");
            let launch_daemons = app_path.join("Contents/Library/LaunchDaemons");

            collect_plist_dir(&launch_agents, "launchd_agent", false, items);
            collect_plist_dir(&launch_daemons, "launchd_daemon", false, items);
        }
    }
}

// ─────────────────────────────────────────
// Directory scanning (with FDA-awareness)
// ─────────────────────────────────────────

fn collect_plist_dir(
    dir: &Path,
    entry_type: &str,
    is_protected: bool,
    items: &mut Vec<StartupItem>,
) -> bool {
    if !dir.exists() {
        return false;
    }
    let Ok(read) = std::fs::read_dir(dir) else { return false };
    let mut found = false;

    for entry in read.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("plist") {
            continue;
        }

        let info = parse_plist(&path);

        // For system directories: only include auto-starting items
        if is_protected && info.as_ref().map_or(true, |i| !is_startup_relevant(i)) {
            continue;
        }

        let name = info
            .as_ref()
            .and_then(|i| i.label.clone())
            .unwrap_or_else(|| {
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("Unknown")
                    .to_string()
            });

        let enabled = info
            .as_ref()
            .and_then(|i| i.disabled)
            .map(|d| !d)
            .unwrap_or(true);

        let description = info.as_ref().and_then(|i| {
            if let Some(ref args) = i.program_arguments {
                if !args.is_empty() {
                    Some(args.join(" "))
                } else {
                    i.program.clone()
                }
            } else {
                i.program.clone()
            }
        });

        let mut item = StartupItem {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path: path.to_string_lossy().to_string(),
            startup_type: entry_type.to_string(),
            enabled,
            publisher: None,
            description,
        };

        // Append "(System)" to system item names for front-end protection detection
        if is_protected {
            item.path = format!("__system__{}", item.path);
        }

        items.push(item);
        found = true;
    }

    found
}

/// Collect all startup items from all sources.
/// Tries system directories but silently skips them if permission is denied.
pub fn collect_startup_items() -> Result<Vec<StartupItem>, AppError> {
    let mut items = Vec::new();

    // 1. User LaunchAgents (~/Library/LaunchAgents)
    if let Some(home) = dirs::home_dir() {
        let user_agents = home.join("Library/LaunchAgents");
        collect_plist_dir(&user_agents, "launchd_agent", false, &mut items);
    }

    // 2. Library LaunchAgents
    collect_plist_dir(
        &PathBuf::from("/Library/LaunchAgents"),
        "launchd_agent",
        false,
        &mut items,
    );

    // 3. Library LaunchDaemons
    collect_plist_dir(
        &PathBuf::from("/Library/LaunchDaemons"),
        "launchd_daemon",
        false,
        &mut items,
    );

    // 4. System LaunchAgents (FDA may be needed)
    collect_plist_dir(
        &PathBuf::from("/System/Library/LaunchAgents"),
        "launchd_agent",
        true,
        &mut items,
    );

    // 5. System LaunchDaemons (FDA may be needed)
    collect_plist_dir(
        &PathBuf::from("/System/Library/LaunchDaemons"),
        "launchd_daemon",
        true,
        &mut items,
    );

    // 6. App bundle LaunchAgents/Daemons
    scan_app_bundle_plists(&mut items);

    // 7. BTM database
    let btm_entries = parse_btm_entries();
    let mut btm_labels: std::collections::HashSet<String> = std::collections::HashSet::new();

    for be in &btm_entries {
        let name = be.name.clone().unwrap_or_else(|| be.identifier.clone());
        btm_labels.insert(be.identifier.clone());

        items.push(StartupItem {
            id: uuid::Uuid::new_v4().to_string(),
            name,
            path: be.url.clone().unwrap_or_else(|| be.identifier.clone()),
            startup_type: be.entry_type.clone(),
            enabled: be.enabled,
            publisher: be.developer_name.clone(),
            description: be.executable_path.clone(),
        });
    }

    // 8. Deduplicate: if a plist item has the same Label as a BTM item, remove it
    items.retain(|item| {
        if item.startup_type == "btm_app" || item.startup_type == "btm_daemon" || item.startup_type == "btm_developer" {
            return true;
        }
        // Check if this plist item's path matches a BTM url
        let is_duplicate = btm_labels.iter().any(|label| item.path.contains(label.as_str()));
        !is_duplicate
    });

    Ok(items)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_btm_text() {
        let sample = r#"
========================
 Records for UID -2 : FFFFEEEE-DDDD-CCCC-BBBB-AAAAFFFFFFFE
========================

 ServiceManagement migrated: true
 Items:

 #1:
                 UUID: ABCD-1234
                 Name: MyApp
       Developer Name: Acme Inc.
                 Type: app (0x2)
          Disposition: [enabled, allowed, visible, notified] (3)
           Identifier: com.acme.myapp
                  URL: file:///Applications/MyApp.app

 #2:
                 UUID: EFGH-5678
                 Name: MyDaemon
       Developer Name: (null)
                 Type: daemon (0x10)
          Disposition: [disabled, allowed] (2)
           Identifier: com.acme.mydaemon
                  URL: (null)
      Executable Path: /usr/local/bin/mydaemon
"#;

        let entries = parse_btm_text(sample);
        assert_eq!(entries.len(), 2);

        assert_eq!(entries[0].name.as_deref(), Some("MyApp"));
        assert_eq!(entries[0].entry_type, "btm_app");
        assert_eq!(entries[0].identifier, "com.acme.myapp");
        assert!(entries[0].enabled);
        assert!(entries[0].url.as_ref().unwrap().contains("MyApp.app"));
        assert_eq!(entries[0].developer_name.as_deref(), Some("Acme Inc."));

        assert_eq!(entries[1].name.as_deref(), Some("MyDaemon"));
        assert_eq!(entries[1].entry_type, "btm_daemon");
        assert!(!entries[1].enabled);
        assert!(entries[1].url.is_none());
        assert_eq!(entries[1].executable_path.as_deref(), Some("/usr/local/bin/mydaemon"));
    }

    #[test]
    fn test_is_startup_relevant() {
        let info = PlistInfo {
            label: None,
            program: None,
            program_arguments: None,
            run_at_load: Some(true),
            keep_alive: None,
            keep_alive_successful_exit: None,
            disabled: None,
        };
        assert!(is_startup_relevant(&info));

        let info2 = PlistInfo {
            label: None,
            program: None,
            program_arguments: None,
            run_at_load: None,
            keep_alive: Some(true),
            keep_alive_successful_exit: None,
            disabled: None,
        };
        assert!(is_startup_relevant(&info2));

        let info3 = PlistInfo {
            label: None,
            program: None,
            program_arguments: None,
            run_at_load: Some(false),
            keep_alive: Some(false),
            keep_alive_successful_exit: None,
            disabled: None,
        };
        assert!(!is_startup_relevant(&info3));
    }
}
