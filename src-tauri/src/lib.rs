mod canvas_commands;
mod feed_commands;
mod file_explorer_commands;
mod schema;
mod timer_commands;

use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use canvas_commands::*;
use feed_commands::*;
use file_explorer_commands::*;
use msedge_tts::tts::{client::connect, SpeechConfig};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};
use timer_commands::*;

fn app_data_file(app: &tauri::AppHandle, filename: &str) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(filename))
}

#[tauri::command]
fn load_favorite_pages(app: tauri::AppHandle) -> Result<String, String> {
    let path = app_data_file(&app, "favorite-pages.json")?;
    if !path.exists() {
        return Ok("{\"favorites\":[]}".to_string());
    }
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_favorite_pages(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let path = app_data_file(&app, "favorite-pages.json")?;
    std::fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_page_visits(app: tauri::AppHandle) -> Result<String, String> {
    let path = app_data_file(&app, "page-visits.json")?;
    if !path.exists() {
        return Ok("{\"visits\":[]}".to_string());
    }
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_page_visits(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let path = app_data_file(&app, "page-visits.json")?;
    std::fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_agenda_events_data() -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("agenda-events.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// Grava num .tmp e renomeia por cima, pra um crash no meio da escrita
/// não deixar o JSON da agenda truncado.
#[tauri::command]
fn save_agenda_events_data(data: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("agenda-events.json");
    let tmp = dir.join("agenda-events.json.tmp");
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

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
fn get_chat_db_url() -> String {
    let dir = std::env::current_dir().expect("não foi possível obter o diretório atual");
    format!("sqlite:{}/chat.db", dir.display())
}

#[tauri::command]
fn save_project_cover(project_id: String, source_path: String) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let covers_dir = dir.join("covers");
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
fn delete_project_cover(project_id: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let covers_dir = dir.join("covers");

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

#[tauri::command]
fn load_kanban_overview_prefs() -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("kanban-overview-prefs.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_tabs_state() -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("tabs-state.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_tabs_state(data: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("tabs-state.json");
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_cover_from_bytes(
    entity_id: String,
    bytes: Vec<u8>,
    extension: String,
) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let covers_dir = dir.join("covers");
    fs::create_dir_all(&covers_dir).map_err(|e| e.to_string())?;

    if let Ok(entries) = fs::read_dir(&covers_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.file_stem().and_then(|s| s.to_str()) == Some(entity_id.as_str()) {
                let _ = fs::remove_file(&path);
            }
        }
    }

    let dest = covers_dir.join(format!("{}.{}", entity_id, extension));
    fs::write(&dest, bytes).map_err(|e| e.to_string())?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn load_pomodoro_data(project_id: String) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("projects").join(&project_id).join("pomodoro.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_pomodoro_data(project_id: String, data: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let project_dir = dir.join("projects").join(&project_id);
    fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;
    let path = project_dir.join("pomodoro.json");
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_agenda_data(project_id: String) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("projects").join(&project_id).join("agenda.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_agenda_data(project_id: String, data: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let project_dir = dir.join("projects").join(&project_id);
    fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;
    let path = project_dir.join("agenda.json");
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_event_gallery_data(project_id: String) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir
        .join("projects")
        .join(&project_id)
        .join("event-gallery.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_event_gallery_data(project_id: String, data: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let project_dir = dir.join("projects").join(&project_id);
    fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;
    let path = project_dir.join("event-gallery.json");
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_modifications(project_id: String) -> Result<Vec<String>, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let mods_dir = dir.join("projects").join(&project_id).join("modifications");
    if !mods_dir.exists() {
        return Ok(vec![]);
    }
    let mut keys = vec![];
    if let Ok(entries) = fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            if entry.path().is_dir() {
                if let Some(name) = entry.file_name().to_str() {
                    keys.push(name.to_string());
                }
            }
        }
    }
    Ok(keys)
}

#[tauri::command]
fn load_modification_file(
    project_id: String,
    mod_key: String,
    file_name: String,
) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir
        .join("projects")
        .join(&project_id)
        .join("modifications")
        .join(&mod_key)
        .join(&file_name);
    if !path.exists() {
        return Ok(String::new());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_modification_file(
    project_id: String,
    mod_key: String,
    file_name: String,
    data: String,
) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let mod_dir = dir
        .join("projects")
        .join(&project_id)
        .join("modifications")
        .join(&mod_key);
    fs::create_dir_all(&mod_dir).map_err(|e| e.to_string())?;
    let path = mod_dir.join(&file_name);
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_modification(project_id: String, mod_key: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let mod_dir = dir
        .join("projects")
        .join(&project_id)
        .join("modifications")
        .join(&mod_key);
    if mod_dir.exists() {
        fs::remove_dir_all(&mod_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[derive(serde::Serialize)]
struct CardFileInfo {
    name: String,
    path: String,
    size: u64,
}

/// MOVE (não copy): tira o arquivo de `source_path` e coloca dentro de `card-files/{card_id}/`,
/// criando a pasta agora se ainda não existir. Tenta `rename` primeiro (instantâneo, mesmo
/// disco); se falhar (comum entre discos/partições diferentes), cai pra copy + remove do
/// original. Se já existir um arquivo com o mesmo nome no destino, acrescenta "(1)", "(2)"...
/// antes da extensão, em vez de sobrescrever.
#[tauri::command]
fn save_card_file(card_id: String, source_path: String) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let card_dir = dir.join("card-files").join(&card_id);
    fs::create_dir_all(&card_dir).map_err(|e| e.to_string())?;

    let source = PathBuf::from(&source_path);
    let file_name = source
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Nome de arquivo inválido")?
        .to_string();
    let stem = source
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("arquivo");
    let ext = source.extension().and_then(|e| e.to_str());

    let mut dest = card_dir.join(&file_name);
    let mut counter = 1;
    while dest.exists() {
        let candidate = match ext {
            Some(e) => format!("{} ({}).{}", stem, counter, e),
            None => format!("{} ({})", stem, counter),
        };
        dest = card_dir.join(candidate);
        counter += 1;
    }

    if fs::rename(&source, &dest).is_err() {
        // rename falha entre discos/partições diferentes — cai pra copy + remove manual
        fs::copy(&source, &dest).map_err(|e| e.to_string())?;
        fs::remove_file(&source).map_err(|e| e.to_string())?;
    }

    Ok(dest.to_string_lossy().to_string())
}

/// Lista os arquivos de `card-files/{card_id}/` — retorna vazio (não erro) se a pasta
/// não existir, que é o caso normal de um card que nunca recebeu arquivo.
#[tauri::command]
fn list_card_files(card_id: String) -> Result<Vec<CardFileInfo>, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let card_dir = dir.join("card-files").join(&card_id);
    if !card_dir.exists() {
        return Ok(vec![]);
    }

    let mut files = vec![];
    if let Ok(entries) = fs::read_dir(&card_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    files.push(CardFileInfo {
                        name: name.to_string(),
                        path: path.to_string_lossy().to_string(),
                        size,
                    });
                }
            }
        }
    }
    Ok(files)
}

/// Remove um arquivo específico do card (não a pasta inteira).
#[tauri::command]
fn delete_card_file(card_id: String, file_name: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("card-files").join(&card_id).join(&file_name);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Lista os ids de card que têm pelo menos um arquivo em `card-files/{cardId}/` — uma
/// varredura só, usada pra decidir pro board inteiro quais cards mostram o botão de abrir
/// pasta, em vez de checar card por card.
#[tauri::command]
fn list_card_ids_with_files() -> Result<Vec<String>, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let base = dir.join("card-files");
    if !base.exists() {
        return Ok(vec![]);
    }

    let mut ids = vec![];
    if let Ok(entries) = fs::read_dir(&base) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let has_file = fs::read_dir(&path)
                .map(|mut it| it.any(|e| e.map(|e| e.path().is_file()).unwrap_or(false)))
                .unwrap_or(false);
            if has_file {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    ids.push(name.to_string());
                }
            }
        }
    }
    Ok(ids)
}

/// Retorna o path absoluto de `card-files/{card_id}/`, criando a pasta agora se ainda não
/// existir — usado só quando o usuário pede explicitamente pra abrir a pasta no explorador
/// do SO (nesse caso faz sentido criar na hora, é uma ação intencional do usuário).
#[tauri::command]
fn get_card_files_dir(card_id: String) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let card_dir = dir.join("card-files").join(&card_id);
    fs::create_dir_all(&card_dir).map_err(|e| e.to_string())?;
    Ok(card_dir.to_string_lossy().to_string())
}

/// Apaga `card-files/{card_id}/` inteira — chamado quando o card é deletado.
/// Mesmo padrão de `delete_modification`: não é erro se a pasta não existir
/// (card que nunca recebeu arquivo).
#[tauri::command]
fn delete_card_files_dir(card_id: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let card_dir = dir.join("card-files").join(&card_id);
    if card_dir.exists() {
        fs::remove_dir_all(&card_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: schema::SCHEMA,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_event_description",
            sql: "ALTER TABLE events ADD COLUMN description TEXT;",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_event_details",
            sql: r#"
                CREATE TABLE IF NOT EXISTS event_details (
                    id TEXT PRIMARY KEY,
                    event_id TEXT NOT NULL,
                    content TEXT NOT NULL DEFAULT '',
                    time_label TEXT,
                    position INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS idx_event_details_event_id
                    ON event_details (event_id, position);
                INSERT INTO event_details (id, event_id, content, position)
                SELECT lower(hex(randomblob(16))), id, description, 0
                FROM events
                WHERE description IS NOT NULL AND trim(description) <> '';
            "#,
            kind: MigrationKind::Up,
        },
    ];

    let chat_migrations = vec![Migration {
        version: 1,
        description: "chat_initial_schema",
        sql: schema::CHAT_SCHEMA,
        kind: MigrationKind::Up,
    }];

    let db_url = {
        let dir = std::env::current_dir().expect("não foi possível obter o diretório atual");
        format!("sqlite:{}/app.db", dir.display())
    };

    let chat_db_url = {
        let dir = std::env::current_dir().expect("não foi possível obter o diretório atual");
        format!("sqlite:{}/chat.db", dir.display())
    };

    #[tauri::command]
    fn load_project_section_config(project_id: String) -> Result<String, String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let path = dir
            .join("projects")
            .join(&project_id)
            .join("project-config.json");
        if !path.exists() {
            return Ok("{}".to_string());
        }
        fs::read_to_string(&path).map_err(|e| e.to_string())
    }

    #[tauri::command]
    fn save_project_section_config(project_id: String, data: String) -> Result<(), String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let project_dir = dir.join("projects").join(&project_id);
        fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;
        let path = project_dir.join("project-config.json");
        fs::write(&path, data).map_err(|e| e.to_string())
    }

    #[tauri::command]
    fn load_page_visibility_prefs() -> Result<String, String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let path = dir.join("page-visibility.json");
        if !path.exists() {
            return Ok("{}".to_string());
        }
        fs::read_to_string(&path).map_err(|e| e.to_string())
    }

    #[tauri::command]
    fn save_page_visibility_prefs(data: String) -> Result<(), String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let path = dir.join("page-visibility.json");
        fs::write(&path, data).map_err(|e| e.to_string())
    }
    #[tauri::command]
    fn load_aside_collapsed_prefs() -> Result<String, String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let path = dir.join("aside-collapsed.json");
        if !path.exists() {
            return Ok("{}".to_string());
        }
        fs::read_to_string(&path).map_err(|e| e.to_string())
    }

    #[tauri::command]
    fn save_aside_collapsed_prefs(data: String) -> Result<(), String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let path = dir.join("aside-collapsed.json");
        fs::write(&path, data).map_err(|e| e.to_string())
    }

    #[tauri::command]
    fn load_study_data() -> Result<String, String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let path = dir.join("study-data.json");
        if !path.exists() {
            return Ok("{}".to_string());
        }
        fs::read_to_string(&path).map_err(|e| e.to_string())
    }

    #[tauri::command]
    fn save_study_data(data: String) -> Result<(), String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let path = dir.join("study-data.json");
        fs::write(&path, data).map_err(|e| e.to_string())
    }

    #[tauri::command]
    fn load_explorer_prefs() -> Result<String, String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let path = dir.join("explorer-prefs.json");
        if !path.exists() {
            return Ok("{}".to_string());
        }
        fs::read_to_string(&path).map_err(|e| e.to_string())
    }

    #[tauri::command]
    fn save_explorer_prefs(data: String) -> Result<(), String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let path = dir.join("explorer-prefs.json");
        fs::write(&path, data).map_err(|e| e.to_string())
    }

    #[tauri::command]
    fn save_kanban_overview_prefs(data: String) -> Result<(), String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let path = dir.join("kanban-overview-prefs.json");
        fs::write(&path, data).map_err(|e| e.to_string())
    }

    #[tauri::command]
    fn load_kanban_data() -> Result<String, String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let path = dir.join("kanban-data.json");
        if !path.exists() {
            return Ok("{}".to_string());
        }
        fs::read_to_string(&path).map_err(|e| e.to_string())
    }

    #[tauri::command]
    fn save_kanban_data(data: String) -> Result<(), String> {
        let dir = std::env::current_dir().map_err(|e| e.to_string())?;
        let path = dir.join("kanban-data.json");
        fs::write(&path, data).map_err(|e| e.to_string())
    }

    #[tauri::command]
    fn synthesize_speech(text: String, voice: Option<String>) -> Result<String, String> {
        if text.trim().is_empty() {
            return Err("Texto vazio.".to_string());
        }

        let config = SpeechConfig {
            voice_name: voice.unwrap_or_else(|| "pt-BR-FranciscaNeural".to_string()),
            audio_format: "audio-24khz-48kbitrate-mono-mp3".to_string(),
            pitch: 0,
            rate: 0,
            volume: 0,
        };

        let mut tts = connect().map_err(|e| format!("Falha ao conectar no serviço de voz: {e}"))?;
        let audio = tts
            .synthesize(&text, &config)
            .map_err(|e| format!("Falha ao sintetizar áudio: {e}"))?;

        Ok(BASE64.encode(audio.audio_bytes))
    }

    #[tauri::command]
    fn rename_card_file(path: String, new_name: String) -> Result<String, String> {
        let old_path = PathBuf::from(&path);

        let in_card_files = old_path.components().any(|c| c.as_os_str() == "card-files");
        if !in_card_files || !old_path.is_file() {
            return Err("Arquivo inválido ou não encontrado.".into());
        }

        let new_name = new_name.trim();
        if new_name.is_empty() || new_name == "." || new_name == ".." {
            return Err("Nome inválido.".into());
        }
        if new_name.chars().any(|c| {
            c.is_control() || matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|')
        }) {
            return Err("O nome não pode ter \\ / : * ? \" < > |".into());
        }
        if new_name.ends_with('.') || new_name.ends_with(' ') {
            return Err("O nome não pode terminar com ponto ou espaço.".into());
        }

        let parent = old_path
            .parent()
            .ok_or("Pasta do arquivo não encontrada.")?;
        let new_path = parent.join(new_name);
        if new_path == old_path {
            return Ok(path);
        }

        // No Windows o sistema de arquivos ignora maiúsculas/minúsculas: "a.txt" -> "A.txt" é o MESMO arquivo e deve ser
        // permitido; qualquer outro caso em que o destino já existe é um conflito de verdade.
        let only_case_changed =
            old_path.to_string_lossy().to_lowercase() == new_path.to_string_lossy().to_lowercase();
        if new_path.exists() && !only_case_changed {
            return Err("Já existe um arquivo com esse nome.".into());
        }

        std::fs::rename(&old_path, &new_path)
            .map_err(|e| format!("Não foi possível renomear: {e}"))?;
        Ok(new_path.to_string_lossy().into_owned())
    }
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, migrations)
                .add_migrations(&chat_db_url, chat_migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            greet,
            get_db_url,
            get_chat_db_url,
            save_project_cover,
            delete_project_cover,
            load_kanban_overview_prefs,
            save_kanban_overview_prefs,
            load_kanban_data,
            save_kanban_data,
            load_tabs_state,
            save_tabs_state,
            load_pomodoro_data,
            save_pomodoro_data,
            load_aside_collapsed_prefs,
            save_aside_collapsed_prefs,
            //
            load_explorer_prefs,
            save_explorer_prefs,
            list_directory,
            get_home_path,
            get_quick_access_locations,
            create_folder,
            rename_path,
            delete_to_trash,
            copy_path,
            move_path,
            list_trash,
            restore_trash_item,
            read_text_file,
            write_text_file,
            get_folder_icons,
            set_folder_icon_from_path,
            set_folder_icon_from_clipboard,
            remove_folder_icon,
            //
            load_study_data,
            save_study_data,
            synthesize_speech,
            //
            load_card_timer_data,
            save_card_timer_data,
            load_active_card_timer,
            save_active_card_timer,
            clear_active_card_timer,
            //
            load_agenda_data,
            save_agenda_data,
            load_page_visibility_prefs,
            save_page_visibility_prefs,
            load_event_gallery_data,
            save_event_gallery_data,
            save_cover_from_bytes,
            list_modifications,
            load_modification_file,
            save_modification_file,
            delete_modification,
            save_card_file,
            list_card_files,
            delete_card_file,
            delete_card_files_dir,
            get_card_files_dir,
            list_card_ids_with_files,
            load_project_section_config,
            save_project_section_config,
            //
            load_canvas_data,
            save_canvas_data,
            save_canvas_asset_bytes,
            import_canvas_asset_from_path,
            delete_canvas_asset,
            //
            load_feed_data,
            save_feed_data,
            save_moment_asset_bytes,
            delete_moment_asset,
            //
            load_favorite_pages,
            save_favorite_pages,
            load_page_visits,
            save_page_visits,
            //
            load_agenda_events_data,
            save_agenda_events_data,
            rename_card_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
