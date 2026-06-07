use tauri::command;

mod idle;
mod server;
use server::UrlSenderHandle;
use std::sync::{Arc, Mutex};

const KEYRING_SERVICE: &str = "spark.solyth.fun";
const KEYRING_USER: &str = "session";

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

#[command]
fn secret_set(value: String) -> Result<(), String> {
    keyring_entry()?
        .set_password(&value)
        .map_err(|e| e.to_string())
}

#[command]
fn secret_get() -> Result<Option<String>, String> {
    match keyring_entry()?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[command]
fn secret_delete() -> Result<(), String> {
    match keyring_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[command]
fn set_open_url(url: String, state: tauri::State<UrlSenderHandle>) -> bool {
    let mut guard = state.lock().unwrap();
    let delivered = match guard.as_ref() {
        Some(tx) => tx.send(url).is_ok(),
        None => false,
    };
    if !delivered {
        *guard = None;
    }
    delivered
}

#[command]
fn set_feed_active(active: bool, state: tauri::State<idle::FeedActive>) {
    idle::set_active(state.inner(), active);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let handle: UrlSenderHandle = Arc::new(Mutex::new(None));
    let feed_active = idle::new_state();

    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        use tauri::Manager;
        builder = builder.plugin(tauri_plugin_single_instance::init(
            |app, _argv, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_focus();
                }
            },
        ));
    }

    builder
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(handle.clone())
        .manage(feed_active.clone())
        .setup(move |app| {
            #[cfg(windows)]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register_all();
            }
            server::start(handle.clone());
            idle::watch(app.handle().clone(), feed_active);
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            set_open_url,
            set_feed_active,
            secret_set,
            secret_get,
            secret_delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
