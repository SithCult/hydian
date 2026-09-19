use plist::{Dictionary, Value};
use std::path::{Path, PathBuf};
use tauri::Manager;

type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

fn path(app: &tauri::AppHandle) -> Result<PathBuf> {
    Ok(app
        .path()
        .home_dir()?
        .join("Library/LaunchAgents")
        .join(format!("{}.plist", app.package_info().name)))
}

// Write the association before macOS observes the new entry; otherwise it falls
// back to the certificate's organization name for the background item.
fn save(path: &Path, entry: Dictionary) -> Result<()> {
    let directory = path.parent().ok_or("missing LaunchAgents directory")?;
    std::fs::create_dir_all(directory)?;
    let mut file = tempfile::NamedTempFile::new_in(directory)?;
    Value::Dictionary(entry).to_writer_xml(file.as_file_mut())?;
    file.persist(path)?;
    Ok(())
}

fn register(path: &Path, name: &str, executable: &Path, identifier: &str) -> Result<()> {
    let mut entry = Dictionary::new();
    entry.insert("Label".into(), name.into());
    entry.insert(
        "ProgramArguments".into(),
        Value::Array(vec![
            executable.to_string_lossy().into_owned().into(),
            "--minimized".into(),
        ]),
    );
    entry.insert("RunAtLoad".into(), true.into());
    entry.insert(
        "AssociatedBundleIdentifiers".into(),
        Value::Array(vec![identifier.into()]),
    );
    save(path, entry)
}

pub fn enable(app: &tauri::AppHandle) -> Result<()> {
    register(
        &path(app)?,
        &app.package_info().name,
        &std::env::current_exe()?.canonicalize()?,
        &app.config().identifier,
    )
}

#[cfg(not(debug_assertions))]
pub fn migrate(app: &tauri::AppHandle) -> Result<()> {
    associate_existing(&path(app)?, &app.config().identifier)
}

#[cfg(any(not(debug_assertions), test))]
fn associate_existing(path: &Path, identifier: &str) -> Result<()> {
    let value = match Value::from_file(path) {
        Ok(value) => value,
        Err(e) if e.as_io().is_some_and(|e| e.kind() == std::io::ErrorKind::NotFound) => return Ok(()),
        Err(e) => return Err(e.into()),
    };
    let mut entry = value.into_dictionary().ok_or("invalid login item")?;
    match entry.get_mut("AssociatedBundleIdentifiers") {
        Some(Value::String(existing)) if existing == identifier => return Ok(()),
        Some(Value::Array(existing)) => {
            if existing.contains(&Value::String(identifier.into())) {
                return Ok(());
            }
            existing.push(identifier.into());
        }
        Some(Value::String(existing)) => {
            let identifiers = vec![Value::String(existing.clone()), identifier.into()];
            entry.insert("AssociatedBundleIdentifiers".into(), identifiers.into());
        }
        _ => {
            entry.insert(
                "AssociatedBundleIdentifiers".into(),
                Value::Array(vec![identifier.into()]),
            );
        }
    }
    save(path, entry)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::os::unix::fs::MetadataExt;

    #[test]
    fn registration_is_associated_and_preserves_special_characters() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("LaunchAgents/Hydian.plist");
        let executable = "/Applications/Games & Tools/Hydian.app/Contents/MacOS/hydian";
        let arguments = Value::Array(vec![executable.into(), "--minimized".into()]);
        register(&path, "Hydian", Path::new(executable), "org.hydian.desktop").unwrap();
        let saved = Value::from_file(&path).unwrap().into_dictionary().unwrap();
        assert_eq!(saved["Label"], Value::String("Hydian".into()));
        assert_eq!(saved["ProgramArguments"], arguments);
        assert_eq!(saved["RunAtLoad"], Value::Boolean(true));
        assert_eq!(
            saved["AssociatedBundleIdentifiers"],
            Value::Array(vec!["org.hydian.desktop".into()])
        );
        assert_eq!(std::fs::read_dir(path.parent().unwrap()).unwrap().count(), 1);
    }

    #[test]
    fn migration_preserves_settings_and_leaves_disabled_startup_disabled() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("Hydian.plist");
        associate_existing(&path, "org.hydian.desktop").unwrap();
        assert!(!path.exists());

        let mut original = Dictionary::new();
        original.insert("Label".into(), "Hydian".into());
        original.insert("RunAtLoad".into(), false.into());
        original.insert("Disabled".into(), true.into());
        original.insert(
            "ProgramArguments".into(),
            Value::Array(vec!["/Applications/Hydian.app/Contents/MacOS/hydian".into()]),
        );
        Value::Dictionary(original.clone()).to_file_xml(&path).unwrap();
        associate_existing(&path, "org.hydian.desktop").unwrap();
        let mut migrated = Value::from_file(&path).unwrap().into_dictionary().unwrap();
        assert!(migrated.remove("AssociatedBundleIdentifiers").is_some());
        assert_eq!(migrated, original);
    }

    #[test]
    fn existing_string_and_array_associations_are_not_rewritten() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("Hydian.plist");
        for association in [
            Value::String("org.hydian.desktop".into()),
            Value::Array(vec!["org.hydian.desktop".into()]),
            Value::Array(vec!["org.example.other".into(), "org.hydian.desktop".into()]),
        ] {
            let mut entry = Dictionary::new();
            entry.insert("AssociatedBundleIdentifiers".into(), association);
            Value::Dictionary(entry).to_file_xml(&path).unwrap();
            let inode = std::fs::metadata(&path).unwrap().ino();
            let original = std::fs::read(&path).unwrap();
            associate_existing(&path, "org.hydian.desktop").unwrap();
            assert_eq!(std::fs::metadata(&path).unwrap().ino(), inode);
            assert_eq!(std::fs::read(&path).unwrap(), original);
        }
    }

    #[test]
    fn migration_keeps_existing_associations() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("Hydian.plist");
        for association in [
            Value::String("org.example.other".into()),
            Value::Array(vec!["org.example.other".into()]),
        ] {
            let mut entry = Dictionary::new();
            entry.insert("AssociatedBundleIdentifiers".into(), association);
            Value::Dictionary(entry).to_file_xml(&path).unwrap();
            associate_existing(&path, "org.hydian.desktop").unwrap();
            let saved = Value::from_file(&path).unwrap().into_dictionary().unwrap();
            assert_eq!(
                saved["AssociatedBundleIdentifiers"],
                Value::Array(vec!["org.example.other".into(), "org.hydian.desktop".into()])
            );
        }
    }

    #[test]
    fn malformed_login_items_are_not_overwritten() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("Hydian.plist");
        for original in [
            "not a property list",
            "<?xml version=\"1.0\"?><plist version=\"1.0\"><string>invalid item</string></plist>",
        ] {
            std::fs::write(&path, original).unwrap();
            assert!(associate_existing(&path, "org.hydian.desktop").is_err());
            assert_eq!(std::fs::read_to_string(&path).unwrap(), original);
        }
    }
}
