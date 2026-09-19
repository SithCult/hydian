// Hydian's entire native surface: three read-only file commands.
//
//  * fs_read_dir  - names in a folder (no per-file stat)
//  * fs_stat      - size + mtime of one file
//  * fs_read      - a byte range of one file, returned as raw bytes (zero-copy IPC)
//
// There is no write command anywhere in this binary. Reads are additionally
// restricted to the two file kinds the app understands (combat logs, .ini),
// so even a wrong folder pick cannot read arbitrary files.
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

use serde::Serialize;
use tauri::ipc::Response;

#[derive(Serialize)]
struct Entry {
    name: String,
    #[serde(rename = "isDir")]
    is_dir: bool,
    size: u64,
    mtime: f64,
}

#[derive(Serialize)]
struct Stat {
    size: u64,
    mtime: f64,
}

fn allowed_file(path: &Path) -> Result<PathBuf, String> {
    let resolved = path.canonicalize().map_err(|e| e.to_string())?;
    allowed_name(path)?;
    allowed_name(&resolved)?;
    if !resolved.is_file() {
        return Err("not a regular file".into());
    }
    Ok(resolved)
}

fn allowed_name(path: &Path) -> Result<(), String> {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("bad path")?
        .to_ascii_lowercase();
    if (name.starts_with("combat_") && name.ends_with(".txt")) || name.ends_with(".ini") {
        Ok(())
    } else {
        Err(format!("refusing to read {name}: not a combat log or .ini"))
    }
}

fn mtime_ms(md: &std::fs::Metadata) -> f64 {
    md.modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

#[tauri::command]
fn fs_read_dir(path: String) -> Result<Vec<Entry>, String> {
    let rd = std::fs::read_dir(&path).map_err(|e| format!("{path}: {e}"))?;
    let mut out = Vec::new();
    for e in rd.flatten() {
        let is_dir = e.file_type().map(|t| t.is_dir()).unwrap_or(false);
        out.push(Entry {
            name: e.file_name().to_string_lossy().into_owned(),
            is_dir,
            size: 0,
            mtime: 0.0,
        });
    }
    Ok(out)
}

#[tauri::command]
fn fs_stat(path: String) -> Result<Stat, String> {
    let p = allowed_file(Path::new(&path))?;
    let md = std::fs::metadata(p).map_err(|e| format!("{path}: {e}"))?;
    Ok(Stat {
        size: md.len(),
        mtime: mtime_ms(&md),
    })
}

#[tauri::command]
fn fs_read(path: String, offset: u64, length: u64) -> Result<Response, String> {
    let p = allowed_file(Path::new(&path))?;
    // File::open is read-only and shares the handle with the game (FILE_SHARE_READ|WRITE on Windows).
    let mut f = File::open(p).map_err(|e| format!("{path}: {e}"))?;
    f.seek(SeekFrom::Start(offset)).map_err(|e| e.to_string())?;
    let mut buf = vec![0u8; length.min(8 * 1024 * 1024) as usize];
    let mut n = 0;
    while n < buf.len() {
        match f.read(&mut buf[n..]) {
            Ok(0) => break,
            Ok(k) => n += k,
            Err(e) => return Err(e.to_string()),
        }
    }
    buf.truncate(n);
    Ok(Response::new(buf))
}

#[cfg(test)]
mod tests {
    use super::allowed_file;
    use std::{
        fs,
        path::PathBuf,
        sync::atomic::{AtomicUsize, Ordering},
    };

    static NEXT_FIXTURE: AtomicUsize = AtomicUsize::new(0);

    struct Fixture(PathBuf);

    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "hydian-native-{}-{}",
                std::process::id(),
                NEXT_FIXTURE.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn accepts_game_files_but_rejects_other_extensions_and_directories() {
        let fixture = Fixture::new();
        for name in ["combat_test.txt", "PlayerGUIState.ini"] {
            let path = fixture.0.join(name);
            fs::write(&path, "synthetic fixture").unwrap();
            assert!(allowed_file(&path).is_ok());
        }
        let private = fixture.0.join("private.txt");
        fs::write(&private, "synthetic fixture").unwrap();
        assert!(allowed_file(&private).is_err());
        let directory = fixture.0.join("combat_directory.txt");
        fs::create_dir(&directory).unwrap();
        assert!(allowed_file(&directory).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn a_symlink_cannot_disguise_a_disallowed_file() {
        let fixture = Fixture::new();
        let target = fixture.0.join("private.txt");
        let link = fixture.0.join("combat_link.txt");
        fs::write(&target, "synthetic fixture").unwrap();
        std::os::unix::fs::symlink(&target, &link).unwrap();
        assert!(allowed_file(&link).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn game_files_in_redirected_directories_remain_readable() {
        let fixture = Fixture::new();
        let directory = fixture.0.join("game");
        let redirected = fixture.0.join("redirected");
        fs::create_dir(&directory).unwrap();
        let target = directory.join("combat_test.txt");
        fs::write(&target, "synthetic fixture").unwrap();
        std::os::unix::fs::symlink(&directory, &redirected).unwrap();
        assert_eq!(
            allowed_file(&redirected.join("combat_test.txt")).unwrap(),
            target.canonicalize().unwrap()
        );
    }
}

/// True when the OS launched us at login (autostart passes `--minimized`): the window starts hidden in the tray.
#[tauri::command]
fn launched_minimized() -> bool {
    std::env::args().any(|a| a == "--minimized")
}

/// Is the game client running? Polled every few seconds; the overlay hides itself while it is not.
/// Process names only; nothing is read from the game process.
fn game_running(sys: &mut sysinfo::System) -> bool {
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    sys.processes().values().any(|p| {
        let n = p.name().to_string_lossy().to_ascii_lowercase();
        n == "swtor.exe" || n == "swtor" || n.starts_with("swtor.")
    })
}

#[tauri::command]
fn is_game_running() -> bool {
    game_running(&mut sysinfo::System::new())
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            fs_read_dir,
            fs_stat,
            fs_read,
            launched_minimized,
            is_game_running
        ])
        .setup(|app| {
            // Hydian lives in the tray like a chat client: closing the window hides it, Quit is in the tray menu.
            let open = MenuItem::with_id(app, "open", "Open Hydian", true, None::<&str>)?;
            let overlay = MenuItem::with_id(app, "overlay", "Toggle overlay", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &overlay, &quit])?;
            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Hydian")
                .on_menu_event(|app, e| match e.id.as_ref() {
                    "open" => show_main(app),
                    "overlay" => {
                        let _ = app.emit_to("main", "overlay:toggle", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, e| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = e
                    {
                        show_main(tray.app_handle());
                    }
                });
            // macOS menu bar: a monochrome template of the mark, tinted by the system. Elsewhere: the app icon.
            #[cfg(target_os = "macos")]
            {
                let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-template@2x.png"))?;
                tray = tray.icon(icon).icon_as_template(true);
            }
            #[cfg(not(target_os = "macos"))]
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;
            if launched_minimized() {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            // game presence, published to both windows as `game` { running }
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut sys = sysinfo::System::new();
                let mut last: Option<bool> = None;
                loop {
                    let running = game_running(&mut sys);
                    if last != Some(running) {
                        last = Some(running);
                        let _ = handle.emit("game", serde_json::json!({ "running": running }));
                    }
                    std::thread::sleep(std::time::Duration::from_secs(5));
                }
            });
            Ok(())
        })
        .on_window_event(|w, e| {
            // main: close = hide to tray. overlay: never closes on its own, only hides.
            if let WindowEvent::CloseRequested { api, .. } = e {
                api.prevent_close();
                let _ = w.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Hydian");
}
