// Cole dentro de src-tauri/src/lib.rs (ou, se preferir, num módulo separado feed_commands.rs
// igual foi feito com canvas_commands.rs — nesse caso, lembre de `mod feed_commands;` e
// `use feed_commands::*;` no topo do lib.rs, e todas as funções abaixo como `pub fn`).

use std::fs;

#[tauri::command]
pub fn load_feed_data() -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("feed.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_feed_data(data: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    fs::write(dir.join("feed.json"), data).map_err(|e| e.to_string())
}

// Retorna path ABSOLUTO — convertFileSrc() no frontend precisa disso (mesmo padrão do Canvas/covers).
#[tauri::command]
pub fn save_moment_asset_bytes(bytes: Vec<u8>, extension: String) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let assets_dir = dir.join("feed-assets");
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    let file_name = format!("{}.{}", uuid::Uuid::new_v4(), extension);
    let dest = assets_dir.join(&file_name);
    fs::write(&dest, bytes).map_err(|e| e.to_string())?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn delete_moment_asset(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    if p.exists() {
        let _ = fs::remove_file(&p);
    }
    Ok(())
}

// -----------------------------------------------------------------------
// Adicione os 4 nomes acima na lista de tauri::generate_handler![...]:
//   load_feed_data,
//   save_feed_data,
//   save_moment_asset_bytes,
//   delete_moment_asset,
// (uuid já deve estar no Cargo.toml se você seguiu o setup do Canvas)
// -----------------------------------------------------------------------
