use tauri::{Emitter, Manager, WebviewUrl, WebviewWindowBuilder, WindowEvent};

fn show_main(app: &tauri::AppHandle) {
  if let Some(win) = app.get_webview_window("main") {
    let _ = win.unminimize();
    let _ = win.show();
    let _ = win.set_focus();
    let _ = win.emit("rijian-shown", ());
    let _ = win.emit("rijian-focus-composer", ());
  }
}

#[tauri::command]
fn show_capture(app: tauri::AppHandle) {
  if let Some(win) = app.get_webview_window("capture") {
    let _ = win.unminimize();
    let _ = win.show();
    let _ = win.set_focus();
  }
}

#[tauri::command]
fn save_journal(app: tauri::AppHandle, json: String) -> Result<(), String> {
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
  let dest = dir.join("journal.json");
  let tmp = dir.join("journal.json.tmp");
  if dest.exists() {
    let _ = std::fs::copy(&dest, dir.join("journal.prev.json"));
  }
  std::fs::write(&tmp, json.as_bytes()).map_err(|e| e.to_string())?;
  std::fs::rename(&tmp, &dest).map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
fn load_journal(app: tauri::AppHandle) -> Result<Option<String>, String> {
  let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
  for name in ["journal.json", "journal.prev.json"] {
    let path = dir.join(name);
    if path.exists() {
      let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
      if !raw.trim().is_empty() {
        return Ok(Some(raw));
      }
    }
  }
  Ok(None)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .invoke_handler(tauri::generate_handler![show_capture, save_journal, load_journal])
    .setup(|app| {
      let _capture = WebviewWindowBuilder::new(app, "capture", WebviewUrl::App("index.html?mode=capture".into()))
        .title("隨手記")
        .inner_size(460.0, 188.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .visible(false)
        .skip_taskbar(true)
        .center()
        .build()?;

      #[cfg(desktop)]
      {
        use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
        let handle = app.handle().clone();
        if let Err(err) = app.global_shortcut().on_shortcut("CommandOrControl+Shift+Space", move |app, _, event| {
          if event.state == ShortcutState::Pressed {
            show_capture(app.clone());
          }
        }) {
          eprintln!("failed to register ⌘⇧Space: {err}");
        }
        if let Err(err) = handle.global_shortcut().on_shortcut("CommandOrControl+N", |app, _, event| {
          if event.state == ShortcutState::Pressed {
            show_main(app);
          }
        }) {
          eprintln!("failed to register ⌘N: {err}");
        }
      }
      Ok(())
    })
    .on_window_event(|window, event| {
      match event {
        WindowEvent::CloseRequested { api, .. } => {
          if window.label() == "main" || window.label() == "capture" {
            api.prevent_close();
            let _ = window.hide();
          }
        }
        WindowEvent::Focused(true) => {
          if window.label() == "main" {
            let _ = window.emit("rijian-shown", ());
          }
        }
        _ => {}
      }
    })
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(|app, event| {
      #[cfg(target_os = "macos")]
      if let tauri::RunEvent::Reopen { .. } = event {
        show_main(app);
      }
    });
}
