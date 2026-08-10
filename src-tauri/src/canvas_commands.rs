use std::fs;

pub fn canvas_scope_dir(dir: &std::path::Path, scope: &Option<String>) -> std::path::PathBuf {
    match scope {
        Some(id) => dir.join("projects").join(id),
        None => dir.to_path_buf(),
    }
}

#[tauri::command]
pub fn load_canvas_data(scope: Option<String>) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = canvas_scope_dir(&dir, &scope).join("canvas.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_canvas_data(scope: Option<String>, data: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let target_dir = canvas_scope_dir(&dir, &scope);
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
    fs::write(target_dir.join("canvas.json"), data).map_err(|e| e.to_string())
}

// Retorna o path ABSOLUTO (não relativo) — convertFileSrc() no frontend precisa disso,
// mesmo padrão de save_project_cover/save_cover_from_bytes.
#[tauri::command]
pub fn save_canvas_asset_bytes(
    scope: Option<String>,
    bytes: Vec<u8>,
    extension: String,
) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let assets_dir = canvas_scope_dir(&dir, &scope).join("canvas-assets");
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    let file_name = format!("{}.{}", uuid::Uuid::new_v4(), extension);
    let dest = assets_dir.join(&file_name);
    fs::write(&dest, bytes).map_err(|e| e.to_string())?;

    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
pub fn import_canvas_asset_from_path(
    scope: Option<String>,
    source_path: String,
) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let assets_dir = canvas_scope_dir(&dir, &scope).join("canvas-assets");
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    let source = std::path::PathBuf::from(&source_path);
    let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let file_name = format!("{}.{}", uuid::Uuid::new_v4(), ext);
    let dest = assets_dir.join(&file_name);

    fs::copy(&source, &dest).map_err(|e| e.to_string())?;

    Ok(dest.to_string_lossy().to_string())
}

// Agora recebe o path ABSOLUTO direto (é o que fica salvo em element.src), sem precisar de `scope`.
#[tauri::command]
pub fn delete_canvas_asset(path: String) -> Result<(), String> {
    let p = std::path::PathBuf::from(&path);
    if p.exists() {
        let _ = fs::remove_file(&p);
    }
    Ok(())
}
