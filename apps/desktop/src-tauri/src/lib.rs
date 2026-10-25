// Game file access uses three read commands and one write.
//
//  * fs_read_dir  - names in a folder (no per-file stat)
//  * fs_stat      - size + mtime of one file
//  * fs_read      - a byte range of one file, returned as raw bytes (zero-copy IPC)
//  * chat_colors_write - the ChatColors line of a PlayerGUIState file, nothing else
//
// Stat and read accept only the game files the app understands: combat logs and the two per-character
// settings files (PlayerGUIState, LocalSocialSettings). Folder listings return names only.
use std::{
    ffi::{OsStr, OsString},
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    time::UNIX_EPOCH,
};
#[cfg(target_os = "macos")]
use tauri::menu::{MenuItemKind, PredefinedMenuItem, HELP_SUBMENU_ID};
#[cfg(not(target_os = "macos"))]
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::{
    menu::{Menu, MenuItem},
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

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
enum WebsitePage {
    Privacy,
    About,
}

impl WebsitePage {
    fn url(self) -> &'static str {
        match self {
            Self::Privacy => "https://www.hydian.org/privacy",
            Self::About => "https://www.hydian.org/about",
        }
    }
}

#[tauri::command]
async fn open_website_page(page: WebsitePage) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || open::that(page.url()))
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
    let combat_log = name.starts_with("combat_") && name.ends_with(".txt");
    let settings = name.ends_with("playerguistate.ini") || name.ends_with("localsocialsettings.ini");
    if combat_log || settings {
        Ok(())
    } else {
        Err(format!(
            "refusing to read {name}: not a combat log or character settings file"
        ))
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

// The one write: the ChatColors line of a character's PlayerGUIState.ini (the chat colour tool).
// Every other line stays byte for byte. The first write keeps the file's original colours in Hydian's
// data folder, never next to the game's files.

fn gui_state_file(path: &Path) -> Result<PathBuf, FileError> {
    let resolved = allowed_file(path)?;
    let name = resolved
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !name.ends_with("_playerguistate.ini") {
        return Err("only character GUI state files hold chat colours".into());
    }
    Ok(resolved)
}

fn chat_colors_line(text: &[u8]) -> Option<(usize, usize)> {
    let mut start = 0;
    for line in text.split(|&b| b == b'\n') {
        let end = start + line.len();
        let trimmed = line.trim_ascii_start();
        if trimmed.len() >= 10
            && trimmed[..10].eq_ignore_ascii_case(b"chatcolors")
            && trimmed[10..].trim_ascii_start().first() == Some(&b'=')
        {
            return Some((start, end));
        }
        start = end + 1;
    }
    None
}

fn line_value(text: &[u8], (start, end): (usize, usize)) -> String {
    let line = &text[start..end];
    let eq = line.iter().position(|&b| b == b'=').map_or(line.len(), |i| i + 1);
    String::from_utf8_lossy(line[eq..].trim_ascii()).into_owned()
}

/// Sets the given colours (6 hex digits; an empty entry keeps the current one) and keeps entries past them.
fn rewrite_chat_colors(text: &[u8], colors: &[String]) -> Result<Vec<u8>, String> {
    if colors.len() > 64 {
        return Err("too many colours".into());
    }
    if let Some(bad) = colors
        .iter()
        .find(|c| !(c.is_empty() || c.len() == 6 && c.bytes().all(|b| b.is_ascii_hexdigit())))
    {
        return Err(format!("not a colour: {bad}"));
    }
    let found = chat_colors_line(text);
    // the game ends the list with ';'; everything before that, empty slots included, is kept as is
    let current = found.map(|range| line_value(text, range)).unwrap_or_default();
    let current = current.strip_suffix(';').unwrap_or(&current);
    let mut values: Vec<String> = if current.is_empty() {
        Vec::new()
    } else {
        current.split(';').map(str::to_owned).collect()
    };
    if values.len() < colors.len() {
        values.resize(colors.len(), String::new());
    }
    for (i, color) in colors.iter().enumerate() {
        if !color.is_empty() {
            values[i] = color.to_ascii_lowercase();
        }
    }
    let line = format!("ChatColors = {};", values.join(";"));
    let mut out = Vec::with_capacity(text.len() + line.len());
    match found {
        Some((start, end)) => {
            let cr = end > start && text[end - 1] == b'\r';
            out.extend_from_slice(&text[..start]);
            out.extend_from_slice(line.as_bytes());
            if cr {
                out.push(b'\r');
            }
            out.extend_from_slice(&text[end..]);
        }
        None => {
            // a character that never changed a colour: the line goes right under [Settings]
            let header = text
                .windows(10)
                .position(|w| w.eq_ignore_ascii_case(b"[settings]"))
                .ok_or("the file has no [Settings] section")?;
            let eol = text[header..]
                .iter()
                .position(|&b| b == b'\n')
                .map_or(text.len(), |i| header + i + 1);
            let newline: &[u8] = if text.windows(2).any(|w| w == b"\r\n") {
                b"\r\n"
            } else {
                b"\n"
            };
            out.extend_from_slice(&text[..eol]);
            if eol == text.len() && !text.ends_with(b"\n") {
                out.extend_from_slice(newline);
            }
            out.extend_from_slice(line.as_bytes());
            out.extend_from_slice(newline);
            out.extend_from_slice(&text[eol..]);
        }
    }
    Ok(out)
}

fn backup_dir(app: &tauri::AppHandle) -> Result<PathBuf, FileError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| FileError::from(e.to_string()))?
        .join("chat-color-backups");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

#[tauri::command]
fn chat_colors_write(app: tauri::AppHandle, path: String, colors: Vec<String>) -> Result<(), FileError> {
    let file = gui_state_file(Path::new(&path))?;
    let text = std::fs::read(&file)?;
    let updated = rewrite_chat_colors(&text, &colors)?;
    if updated == text {
        return Ok(());
    }
    let name = file.file_name().ok_or("bad path")?;
    let backup = backup_dir(&app)?.join(name);
    if !backup.exists() {
        std::fs::write(&backup, &text)?;
    }
    // write next to the file, then swap it in, so the game never reads a half-written file
    let staged = file.with_extension("ini.hydian");
    std::fs::write(&staged, &updated)?;
    if let Err(error) = std::fs::rename(&staged, &file) {
        let _ = std::fs::remove_file(&staged);
        return Err(error.into());
    }
    Ok(())
}

#[tauri::command]
fn chat_colors_original(app: tauri::AppHandle, path: String) -> Result<Option<String>, FileError> {
    let name = Path::new(&path).file_name().ok_or("bad path")?.to_owned();
    gui_state_file(Path::new(&path))?;
    let Ok(text) = std::fs::read(backup_dir(&app)?.join(name)) else {
        return Ok(None);
    };
    Ok(chat_colors_line(&text).map(|range| line_value(&text, range)))
}

#[cfg(test)]
mod tests {
    use super::{allowed_file, fs_read_dir, rewrite_chat_colors, swtor_process, FileError, WebsitePage};
    use std::{
        ffi::{OsStr, OsString},
        fs,
        path::PathBuf,
        sync::atomic::{AtomicUsize, Ordering},
    };

    static NEXT_FIXTURE: AtomicUsize = AtomicUsize::new(0);

    #[test]
    fn game_detection_recognizes_native_and_wine_clients_without_matching_other_apps() {
        let cases: &[(&str, &[&str], Option<bool>)] = &[
            ("swtor.exe", &[], Some(true)),
            ("SWTOR", &[], Some(true)),
            (
                "wine64-preloader",
                &[r"C:\Program Files\Star Wars-The Old Republic\swtor\retailclient\swtor.exe"],
                Some(true),
            ),
            (
                "wine-preloader",
                &[
                    "/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine",
                    "\"C:\\Games\\SWTOR.EXE\"",
                ],
                Some(true),
            ),
            (
                "wine64-preloader",
                &[
                    "wine64-preloader",
                    "/Whisky/Libraries/Wine/bin/wine64",
                    "/Games/SWTOR/swtor.exe",
                ],
                Some(true),
            ),
            ("wine64-preloader", &["wine64", "notepad.exe", "swtor.exe"], Some(false)),
            (
                "wine64-preloader",
                &["wine64", "/Games/SWTOR/launcher.exe"],
                Some(false),
            ),
            (
                "wine64-preloader",
                &["wine64", "/Screenshots/swtor.exe.png"],
                Some(false),
            ),
            ("wineserver", &["swtor.exe"], Some(false)),
            ("swtor.log", &[], Some(false)),
            ("Hydian", &[], Some(false)),
            ("wine64-preloader", &[], None),
            ("wine64-preloader", &["wine64"], None),
            (
                "wine64-preloader",
                &["wine64", "start", "/unix", "/Games/swtor.exe"],
                None,
            ),
            (
                "wine64-preloader",
                &["wine64", "start.exe", "/unix", "/Games/swtor.exe"],
                None,
            ),
            (
                "wine64-preloader",
                &["wine64", "--unknown-wrapper-option", "swtor.exe"],
                None,
            ),
        ];
        for (name, args, expected) in cases {
            let args = args.iter().map(OsString::from).collect::<Vec<_>>();
            assert_eq!(swtor_process(OsStr::new(name), &args), *expected, "{name}: {args:?}");
        }
    }

    #[test]
    fn website_pages_only_accept_known_destinations() {
        for (page, url) in [
            ("privacy", "https://www.hydian.org/privacy"),
            ("about", "https://www.hydian.org/about"),
        ] {
            let page: WebsitePage = serde_json::from_value(serde_json::json!(page)).unwrap();
            assert_eq!(page.url(), url);
        }
        for value in ["https://example.com", "file:///tmp/private", "../about", "About", ""] {
            assert!(serde_json::from_value::<WebsitePage>(serde_json::json!(value)).is_err());
        }
    }

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
    fn accepts_game_files_but_rejects_other_files_and_directories() {
        let fixture = Fixture::new();
        for name in [
            "combat_test.txt",
            "PlayerGUIState.ini",
            "he4000_Test_PlayerGUIState.ini",
            "he4000_Test_LocalSocialSettings.ini",
        ] {
            let path = fixture.0.join(name);
            fs::write(&path, "synthetic fixture").unwrap();
            assert!(allowed_file(&path).is_ok(), "{name}");
        }
        for name in ["private.txt", "desktop.ini", "credentials.ini"] {
            let path = fixture.0.join(name);
            fs::write(&path, "synthetic fixture").unwrap();
            assert!(allowed_file(&path).is_err(), "{name}");
        }
        let directory = fixture.0.join("combat_directory.txt");
        fs::create_dir(&directory).unwrap();
        assert!(allowed_file(&directory).is_err());
    }

    #[test]
    fn chat_colors_change_only_their_own_line() {
        let colors = |v: &[&str]| v.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        let text = b"[Settings]\r\nGUI_A = 1\r\nChatColors = b3ecff;ff7397;;a59ff3;;;;\r\nGUI_B = caf\xe9\r\n";
        let out = rewrite_chat_colors(text, &colors(&["AABBCC", "", "112233"])).unwrap();
        assert_eq!(
            out,
            b"[Settings]\r\nGUI_A = 1\r\nChatColors = aabbcc;ff7397;112233;a59ff3;;;;\r\nGUI_B = caf\xe9\r\n"
        );

        let fresh = b"[Settings]\nGUI_A = 1\n";
        let out = rewrite_chat_colors(fresh, &colors(&["aabbcc", "ddeeff"])).unwrap();
        assert_eq!(out, b"[Settings]\nChatColors = aabbcc;ddeeff;\nGUI_A = 1\n");

        assert!(rewrite_chat_colors(text, &colors(&["red"])).is_err());
        assert!(rewrite_chat_colors(text, &colors(&["aabbcc\nGUI_X = 1"])).is_err());
        assert!(rewrite_chat_colors(b"GUI_A = 1\n", &colors(&["aabbcc"])).is_err());
        // a key that only starts with the name is a different setting
        let similar = b"[Settings]\nChatColorsVersion = 2\n";
        let out = rewrite_chat_colors(similar, &colors(&["aabbcc"])).unwrap();
        assert_eq!(out, b"[Settings]\nChatColors = aabbcc;\nChatColorsVersion = 2\n");
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

fn executable_name(value: &OsStr) -> String {
    value
        .to_string_lossy()
        .trim_matches('"')
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or_default()
        .to_ascii_lowercase()
}

fn is_wine_loader(name: &str) -> bool {
    matches!(
        name,
        "wine" | "wine64" | "wine32on64" | "wine-preloader" | "wine64-preloader" | "wine32on64-preloader"
    )
}

fn swtor_process(name: &OsStr, command: &[OsString]) -> Option<bool> {
    let name = executable_name(name);
    if name == "swtor" || name == "swtor.exe" {
        return Some(true);
    }
    if !is_wine_loader(&name) {
        return Some(false);
    }
    // Wine's macOS executable name identifies the loader, not the Windows game.
    // Inspect only its program argument, never arbitrary later arguments or its environment.
    command
        .iter()
        .map(|arg| executable_name(arg))
        .find(|arg| !is_wine_loader(arg))
        .filter(|program| {
            !program.is_empty() && !program.starts_with('-') && program != "start" && program != "start.exe"
        })
        .map(|program| program == "swtor" || program == "swtor.exe")
}

/// None means process detection is unavailable; it must not hide the overlay.
fn game_running(sys: &mut sysinfo::System) -> Option<bool> {
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, UpdateKind};
    let names = ProcessRefreshKind::nothing().without_tasks();
    if sys.refresh_processes_specifics(ProcessesToUpdate::All, true, names) == 0 {
        return None;
    }
    let loaders: Vec<_> = sys
        .processes()
        .iter()
        .filter(|(_, p)| is_wine_loader(&executable_name(p.name())))
        .map(|(pid, _)| *pid)
        .collect();
    if !loaders.is_empty() {
        sys.refresh_processes_specifics(
            ProcessesToUpdate::Some(&loaders),
            true,
            names.with_cmd(UpdateKind::OnlyIfNotSet),
        );
    }
    let mut unknown = false;
    for process in sys.processes().values() {
        match swtor_process(process.name(), process.cmd()) {
            Some(true) => return Some(true),
            None => unknown = true,
            Some(false) => {}
        }
    }
    if unknown {
        None
    } else {
        Some(false)
    }
}

#[tauri::command]
fn is_game_running() -> Option<bool> {
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
    let builder = tauri::Builder::default();
    // macOS has one menu bar for the whole app. On Windows a menu strip would be a second bar under the
    // title bar, and everything in it (version, updates, privacy) is in Settings, so the window has none.
    #[cfg(target_os = "macos")]
    let builder = builder
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
        });
    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
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
            chat_colors_write,
            chat_colors_original,
            launched_minimized,
            is_game_running,
            autostart_enable,
            open_website_page,
            set_tray_visible
        ])
        .setup(|app| {
            // Everywhere but macOS the app draws its own caption buttons (ui/WindowChrome), so the window
            // has no system title bar. It is created hidden and shown here, after the frame is settled.
            if let Some(main) = app.get_webview_window("main") {
                #[cfg(not(target_os = "macos"))]
                {
                    let _ = main.set_decorations(false);
                    let _ = main.set_shadow(true);
                }
                if !launched_minimized() {
                    let _ = main.show();
                }
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
            // game presence, published to both windows as `game` { running }
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut sys = sysinfo::System::new();
                let mut last = None;
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
