// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use tauri::command;

mod server;
use server::UrlSenderHandle;
use std::sync::{Arc, Mutex};

#[tauri::command]
fn set_open_url(url: String, state: tauri::State<UrlSenderHandle>) {
    if let Some(tx) = state.lock().unwrap().as_ref() {
        let _ = tx.send(url);
    }
}

#[command]
fn get_device_id() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::HKEY_LOCAL_MACHINE;
        use winreg::RegKey;

        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let key = hklm
            .open_subkey(r"SOFTWARE\Microsoft\Cryptography")
            .map_err(|e| format!("Registry access error: {}", e))?;

        key.get_value("MachineGuid")
            .map_err(|e| format!("MachineGuid not found: {}", e))
    }

    #[cfg(target_os = "macos")]
    {
        use regex::Regex;
        use std::process::Command;

        let output = Command::new("ioreg")
            .args(["-rd1", "-c", "IOPlatformExpertDevice"])
            .output()
            .map_err(|e| format!("Failed to execute ioreg: {}", e))?;

        if !output.status.success() {
            return Err("ioreg command failed".to_string());
        }

        let text = String::from_utf8_lossy(&output.stdout);

        // Regex для надёжного парсинга UUID
        let re = Regex::new(r#""IOPlatformUUID"\s*=\s*"([0-9A-Fa-f-]+)""#)
            .map_err(|e| format!("Regex compilation error: {}", e))?;

        re.captures(&text)
            .and_then(|cap| cap.get(1))
            .map(|m| m.as_str().to_string())
            .ok_or_else(|| "IOPlatformUUID not found in ioreg output".to_string())
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("Unsupported operating system".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let handle: UrlSenderHandle = Arc::new(Mutex::new(None));

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(handle.clone())
        .setup(move |_app| {
            server::start(handle.clone());
            Ok(())
        })
        .plugin(tauri_plugin_websocket::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_device_id, set_open_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
