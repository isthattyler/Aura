mod error;
mod models;
mod platform;
mod scanner;
mod cleaner;
mod commands;
mod menubar;

use commands::scan::ScanState;
use menubar::setup_menubar;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .manage(ScanState::new())
        .invoke_handler(tauri::generate_handler![
            // Permission
            commands::permission::check_permission,
            commands::permission::request_permission,
            // Scan
            commands::scan::start_scan,
            commands::scan::scan_category,
            commands::scan::get_scan_results,
            commands::scan::clear_scan_results,
            commands::scan::cancel_scan,
            // Clean
            commands::clean::clean_items,
            commands::clean::empty_trash,
            commands::clean::undo_last_clean,
            // System
            commands::system::get_system_stats,
            commands::system::get_platform,
            // Apps
            commands::apps::list_installed_apps,
            commands::apps::get_app_leftovers,
            commands::apps::uninstall_app,
            // Startup
            commands::startup::list_startup_items,
            commands::startup::toggle_startup_item,
            commands::startup::remove_startup_item,
            // Disk
            commands::disk::get_volumes,
            commands::disk::get_disk_usage,
            // Privacy
            commands::privacy::scan_privacy,
            commands::privacy::clean_privacy,
            // Maintenance
            commands::maintenance::free_up_ram,
        ])
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            setup_menubar(app)?;

            // Close-to-tray: hide window instead of quitting
            let window = app.get_webview_window("main").unwrap();
            let w = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = w.hide();
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running aura application");
}
