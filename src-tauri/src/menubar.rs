use std::error::Error;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    AppHandle, Manager,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{TrayIconBuilder, TrayIconEvent},
};

struct MenuItems {
    quick_clean: Mutex<tauri::menu::MenuItem<tauri::Wry>>,
    clear_ram: Mutex<tauri::menu::MenuItem<tauri::Wry>>,
}

#[cfg(target_os = "macos")]
pub fn setup_menubar(app: &tauri::App) -> Result<(), Box<dyn Error>> {
    let handle = app.handle();

    let quick_clean = MenuItemBuilder::with_id("quick_clean", "Quick Clean").build(handle)?;
    let clear_ram   = MenuItemBuilder::with_id("clear_ram", "Clear RAM").build(handle)?;
    let open_aura   = MenuItemBuilder::with_id("open_aura", "Open Aura").build(handle)?;
    let quit        = MenuItemBuilder::with_id("quit", "Quit Aura").build(handle)?;

    app.manage(MenuItems {
        quick_clean: Mutex::new(quick_clean.clone()),
        clear_ram: Mutex::new(clear_ram.clone()),
    });

    let menu = MenuBuilder::new(handle)
        .item(&quick_clean)
        .item(&clear_ram)
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
fn with_menu_item<F, R>(app: &AppHandle, id: &str, f: F) -> Option<R>
where
    F: FnOnce(&tauri::menu::MenuItem<tauri::Wry>) -> R,
{
    let items = app.state::<MenuItems>();
    let guard = match id {
        "quick_clean" => items.quick_clean.lock().ok()?,
        "clear_ram" => items.clear_ram.lock().ok()?,
        _ => return None,
    };
    Some(f(&*guard))
}

#[cfg(target_os = "macos")]
fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let id = event.id().clone();
    let id_str = id.as_ref().to_string();

    match id_str.as_str() {
        "quick_clean" => {
            let app_clone = app.clone();
            with_menu_item(app, "quick_clean", |item| {
                let _ = item.set_text("Quick Clean — running…");
                let _ = item.set_enabled(false);
            });

            tauri::async_runtime::spawn(async move {
                match crate::commands::scan::run_quick_clean(&app_clone).await {
                    Ok((_, items, bytes)) => {
                        let size_str = crate::commands::system::format_size(bytes);
                        with_menu_item(&app_clone, "quick_clean", |item| {
                            let _ = item.set_text("Quick Clean ✓");
                        });
                        send_notification(
                            &app_clone,
                            "Quick Clean",
                            &format!("Cleaned {} items ({})", items, size_str),
                        );
                    }
                    Err(e) => {
                        log::error!("Quick Clean from menubar failed: {}", e);
                        with_menu_item(&app_clone, "quick_clean", |item| {
                            let _ = item.set_text("Quick Clean ✗");
                        });
                    }
                }
                tokio::time::sleep(Duration::from_secs(2)).await;
                with_menu_item(&app_clone, "quick_clean", |item| {
                    let _ = item.set_text("Quick Clean");
                    let _ = item.set_enabled(true);
                });
            });
        }
        "clear_ram" => {
            let app_clone = app.clone();
            with_menu_item(app, "clear_ram", |item| {
                let _ = item.set_text("Clear RAM — freeing…");
                let _ = item.set_enabled(false);
            });

            std::thread::spawn(move || {
                match crate::commands::maintenance::free_up_ram() {
                    Ok(result) => {
                        let size_str = crate::commands::system::format_size(result.bytes_freed);
                        with_menu_item(&app_clone, "clear_ram", |item| {
                            let _ = item.set_text("Clear RAM ✓");
                        });
                        send_notification(
                            &app_clone,
                            "RAM Freed",
                            &format!("{} — {}", result.message, size_str),
                        );
                    }
                    Err(e) => {
                        log::error!("Clear RAM from menubar failed: {}", e);
                        with_menu_item(&app_clone, "clear_ram", |item| {
                            let _ = item.set_text("Clear RAM ✗");
                        });
                    }
                }
                std::thread::sleep(Duration::from_secs(2));
                with_menu_item(&app_clone, "clear_ram", |item| {
                    let _ = item.set_text("Clear RAM");
                    let _ = item.set_enabled(true);
                });
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
