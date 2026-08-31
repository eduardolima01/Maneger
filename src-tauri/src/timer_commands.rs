use std::fs;

#[tauri::command]
pub fn load_card_timer_data(project_id: String) -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir
        .join("projects")
        .join(&project_id)
        .join("card-timer.json");
    if !path.exists() {
        return Ok("{}".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_card_timer_data(project_id: String, data: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let project_dir = dir.join("projects").join(&project_id);
    fs::create_dir_all(&project_dir).map_err(|e| e.to_string())?;
    let path = project_dir.join("card-timer.json");
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_active_card_timer() -> Result<String, String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("active-card-timer.json");
    if !path.exists() {
        return Ok("null".to_string());
    }
    fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_active_card_timer(data: String) -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("active-card-timer.json");
    fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_active_card_timer() -> Result<(), String> {
    let dir = std::env::current_dir().map_err(|e| e.to_string())?;
    let path = dir.join("active-card-timer.json");
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    Ok(())
}
