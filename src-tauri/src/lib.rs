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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![Migration {
        version: 1,
        description: "initial_schema",
        sql: include_str!("../migrations/schema.sql"),
        kind: MigrationKind::Up,
    }];

    let db_url = {
        let dir = std::env::current_dir().expect("não foi possível obter o diretório atual");
        format!("sqlite:{}/app.db", dir.display())
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![greet, get_db_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
