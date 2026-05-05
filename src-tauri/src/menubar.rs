use std::error::Error;
use tauri::{
    AppHandle, Manager,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
};

#[cfg(target_os = "macos")]
pub fn setup_menubar(app: &tauri::App) -> Result<(), Box<dyn Error>> {
    let handle = app.handle();

    let smart_scan = MenuItemBuilder::with_id("smart_scan", "Run Smart Scan").build(handle)?;
    let free_ram   = MenuItemBuilder::with_id("free_ram", "Free Up RAM").build(handle)?;
    let open_aura  = MenuItemBuilder::with_id("open_aura", "Open Aura").build(handle)?;
    let quit       = MenuItemBuilder::with_id("quit", "Quit Aura").build(handle)?;

    let menu = MenuBuilder::new(handle)
        .item(&smart_scan)
        .item(&free_ram)
        .separator()
        .item(&open_aura)
        .separator()
        .item(&quit)
        .build()?;

    let tray_icon = app
        .default_window_icon()
        .cloned()
        .ok_or("No default window icon configured")?;

    TrayIconBuilder::with_id("aura-tray")
        .icon(tray_icon)
        .icon_as_template(true)
        .tooltip("Aura")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(handle_menu_event)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick { .. } = event {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub fn setup_menubar(_app: &tauri::App) -> Result<(), Box<dyn Error>> {
    Ok(())
}

#[cfg(target_os = "macos")]
fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id().as_ref() {
        "smart_scan" => {
            let app_clone = app.clone();
            tauri::async_runtime::spawn(async move {
                let scan_state = app_clone.state::<crate::commands::scan::ScanState>();
                let cancelled = scan_state.cancelled.clone();
                match crate::commands::scan::run_scan(&app_clone, &Default::default(), cancelled).await {
                    Ok(results) => {
                        let item_count = results.items.len();
                        let size = results.total_bytes;
                        let size_str = crate::commands::system::format_size(size);
                        send_notification(
                            &app_clone,
                            "Smart Scan Complete",
                            &format!("Found {} items ({})", item_count, size_str),
                        );
                    }
                    Err(e) => {
                        log::error!("Smart scan from menubar failed: {}", e);
                    }
                }
            });
        }
        "free_ram" => {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                match crate::commands::maintenance::free_up_ram() {
                    Ok(result) => {
                        let size_str = crate::commands::system::format_size(result.bytes_freed);
                        send_notification(
                            &app_clone,
                            "RAM Freed",
                            &format!("{} — {}", result.message, size_str),
                        );
                    }
                    Err(e) => {
                        log::error!("Free RAM from menubar failed: {}", e);
                    }
                }
            });
        }
        "open_aura" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}

#[cfg(target_os = "macos")]
fn send_notification(app: &AppHandle, title: &str, body: &str) {
    use tauri_plugin_notification::NotificationExt;
    let _ = app
        .notification()
        .builder()
        .title(title)
        .body(body.to_string())
        .show();
}
