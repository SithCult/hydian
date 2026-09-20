// Game file access uses three read-only commands.
//
//  * fs_read_dir  - names in a folder (no per-file stat)
//  * fs_stat      - size + mtime of one file
//  * fs_read      - a byte range of one file, returned as raw bytes (zero-copy IPC)
//
// Reads are restricted to the two file kinds the app understands (combat logs, .ini),
// so even a wrong folder pick cannot read arbitrary files.
use std::{
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
#[cfg(not(target_os = "macos"))]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::{
    menu::{Menu, MenuItem, MenuItemKind, PredefinedMenuItem, HELP_SUBMENU_ID},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
};

use serde::Serialize;
use tauri::ipc::Response;

#[cfg(target_os = "macos")]
mod autostart;

const TRAY_ID: &str = "hydian-tray";
#[cfg(target_os = "macos")]
type TrayVisibilityItem = tauri::menu::CheckMenuItem<tauri::Wry>;

#[tauri::command]
fn set_tray_visible(app: tauri::AppHandle, visible: bool) -> Result<(), String> {
    let tray = app.tray_by_id(TRAY_ID).ok_or("Hydian's menu-bar icon is unavailable")?;
    #[cfg(target_os = "macos")]
    let item = app
        .try_state::<TrayVisibilityItem>()
        .ok_or("Hydian's menu-bar setting is unavailable")?;
    #[cfg(target_os = "macos")]
    let previous = item.is_checked().map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    item.set_checked(visible).map_err(|e| e.to_string())?;
    if let Err(error) = tray.set_visible(visible) {
        #[cfg(target_os = "macos")]
        let _ = item.set_checked(previous);
        return Err(error.to_string());
    }
    Ok(())
}

#[tauri::command]
async fn open_privacy_policy() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(|| open::that("https://hydian.org/privacy"))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn autostart_enable(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    return autostart::enable(&app).map_err(|e| e.to_string());

    #[cfg(not(target_os = "macos"))]
    {
        use tauri_plugin_autostart::ManagerExt;
        app.autolaunch().enable().map_err(|e| e.to_string())
    }
}

#[derive(Debug, Serialize)]
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

#[derive(Debug, Serialize)]
struct FileError {
    code: &'static str,
    message: String,
}

impl From<std::io::Error> for FileError {
    fn from(error: std::io::Error) -> Self {
        let code = match error.kind() {
            std::io::ErrorKind::NotFound => "not-found",
            std::io::ErrorKind::PermissionDenied => "permission-denied",
            std::io::ErrorKind::NotADirectory => "not-directory",
            _ => "unavailable",
        };
        Self {
            code,
            message: error.to_string(),
        }
    }
}

impl From<String> for FileError {
    fn from(message: String) -> Self {
        Self {
            code: "unavailable",
            message,
        }
    }
}

impl From<&str> for FileError {
    fn from(message: &str) -> Self {
        message.to_owned().into()
    }
}

fn allowed_file(path: &Path) -> Result<PathBuf, FileError> {
    let resolved = path.canonicalize()?;
    allowed_name(path)?;
    allowed_name(&resolved)?;
    if !std::fs::metadata(&resolved)?.is_file() {
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
fn fs_read_dir(path: String) -> Result<Vec<Entry>, FileError> {
    let rd = std::fs::read_dir(&path)?;
    let mut out = Vec::new();
    for e in rd {
        let e = e?;
        let is_dir = e.file_type()?.is_dir();
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
fn fs_stat(path: String) -> Result<Stat, FileError> {
    let p = allowed_file(Path::new(&path))?;
    let md = std::fs::metadata(p)?;
    Ok(Stat {
        size: md.len(),
        mtime: mtime_ms(&md),
    })
}

#[tauri::command]
fn fs_read(path: String, offset: u64, length: u64) -> Result<Response, FileError> {
    let p = allowed_file(Path::new(&path))?;
    // File::open is read-only and shares the handle with the game (FILE_SHARE_READ|WRITE on Windows).
    let mut f = File::open(p)?;
    f.seek(SeekFrom::Start(offset))?;
    let mut buf = vec![0u8; length.min(8 * 1024 * 1024) as usize];
    let mut n = 0;
    while n < buf.len() {
        match f.read(&mut buf[n..]) {
            Ok(0) => break,
            Ok(k) => n += k,
            Err(e) => return Err(e.into()),
        }
    }
    buf.truncate(n);
    Ok(Response::new(buf))
}

#[cfg(test)]
mod tests {
    use super::{allowed_file, fs_read_dir, FileError};
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
    fn directory_errors_keep_machine_readable_codes() {
        let fixture = Fixture::new();
        assert_eq!(
            fs_read_dir(fixture.0.join("missing").to_string_lossy().into())
                .unwrap_err()
                .code,
            "not-found"
        );
        let file = fixture.0.join("combat_test.txt");
        fs::write(&file, "synthetic fixture").unwrap();
        assert_eq!(
            fs_read_dir(file.to_string_lossy().into()).unwrap_err().code,
            "not-directory"
        );
        assert_eq!(
            FileError::from(std::io::Error::from(std::io::ErrorKind::PermissionDenied)).code,
            "permission-denied"
        );
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
        .menu(|app| {
            let menu = Menu::default(app)?;
            if let Some(MenuItemKind::Submenu(help)) = menu.get(HELP_SUBMENU_ID) {
                help.append_items(&[
                    &MenuItem::with_id(
                        app,
                        "help-about",
                        format!("Hydian {}", app.package_info().version),
                        true,
                        None::<&str>,
                    )?,
                    &MenuItem::with_id(app, "help-update", "Check for Updates…", true, None::<&str>)?,
                    &PredefinedMenuItem::separator(app)?,
                    &MenuItem::with_id(app, "help-privacy", "Privacy Policy…", true, None::<&str>)?,
                ])?;
            }
            Ok(menu)
        })
        .on_menu_event(|app, event| {
            let id = event.id.as_ref();
            if matches!(id, "help-about" | "help-update" | "help-privacy") {
                if id != "help-privacy" {
                    show_main(app);
                }
                let _ = app.emit_to("main", "help:action", id);
            }
        })
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
            is_game_running,
            autostart_enable,
            open_privacy_policy,
            set_tray_visible
        ])
        .setup(|app| {
            // The game overlay should not inherit the main window's menu bar.
            #[cfg(not(target_os = "macos"))]
            if let Some(overlay) = app.get_webview_window("overlay") {
                overlay.remove_menu()?;
            }
            #[cfg(all(target_os = "macos", not(debug_assertions)))]
            if let Err(e) = autostart::migrate(app.handle()) {
                eprintln!("Could not associate the login item with Hydian: {e}");
            }
            // Hydian lives in the tray like a chat client: closing the window hides it, Quit is in the tray menu.
            let open = MenuItem::with_id(app, "open", "Open Hydian", true, None::<&str>)?;
            let overlay = MenuItem::with_id(app, "overlay", "Show in-game overlay", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &overlay])?;
            #[cfg(target_os = "macos")]
            {
                let item = TrayVisibilityItem::with_id(
                    app,
                    "tray-visible",
                    "Show Hydian in Menu Bar",
                    true,
                    true,
                    None::<&str>,
                )?;
                menu.append_items(&[&PredefinedMenuItem::separator(app)?, &item])?;
                app.manage(item);
            }
            menu.append(&quit)?;
            let mut tray = TrayIconBuilder::with_id(TRAY_ID)
                .menu(&menu)
                .show_menu_on_left_click(cfg!(target_os = "macos"))
                .tooltip("Hydian")
                .on_menu_event(|app, e| match e.id.as_ref() {
                    "open" => show_main(app),
                    "overlay" => {
                        let _ = app.emit_to("main", "overlay:show", ());
                    }
                    #[cfg(target_os = "macos")]
                    "tray-visible" => {
                        // Native checkbox clicks toggle before our persisted setting is applied.
                        if let Some(item) = app.try_state::<TrayVisibilityItem>() {
                            let _ = item.set_checked(true);
                        }
                        let _ = app.emit_to("main", "tray:hide", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|_tray, _event| {
                    #[cfg(not(target_os = "macos"))]
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = _event
                    {
                        show_main(_tray.app_handle());
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
        .build(tauri::generate_context!())
        .expect("error while building Hydian")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                // The overlay may be visible even when the main window is hidden.
                show_main(_app);
            }
        });
}
