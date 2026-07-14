mod schema;

use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_db_url() -> String {
    let dir = std::env::current_dir().expect("não foi possível obter o diretório atual");
    format!("sqlite:{}/app.db", dir.display())
}

#[tauri::command]
fn save_project_cover(
    app_handle: tauri::AppHandle,
    project_id: String,
    source_path: String,
) -> Result<String, String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let covers_dir = app_dir.join("covers");
    fs::create_dir_all(&covers_dir).map_err(|e| e.to_string())?;

    if let Ok(entries) = fs::read_dir(&covers_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.file_stem().and_then(|s| s.to_str()) == Some(project_id.as_str()) {
                let _ = fs::remove_file(&path);
            }
        }
    }

    let source = PathBuf::from(&source_path);
    let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let dest = covers_dir.join(format!("{}.{}", project_id, ext));

    fs::copy(&source, &dest).map_err(|e| e.to_string())?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_project_cover(app_handle: tauri::AppHandle, project_id: String) -> Result<(), String> {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let covers_dir = app_dir.join("covers");

    if let Ok(entries) = fs::read_dir(&covers_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.file_stem().and_then(|s| s.to_str()) == Some(project_id.as_str()) {
                let _ = fs::remove_file(&path);
            }
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial_schema",
        sql: schema::SCHEMA,
        kind: MigrationKind::Up,
    }];

    let db_url = {
        let dir = std::env::current_dir().expect("não foi possível obter o diretório atual");
        format!("sqlite:{}/app.db", dir.display())
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            greet,
            get_db_url,
            save_project_cover,
            delete_project_cover
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
