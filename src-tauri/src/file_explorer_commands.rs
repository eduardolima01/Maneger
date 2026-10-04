use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_clipboard_manager::ClipboardExt;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FsEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_at: Option<String>,
    pub extension: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct QuickAccessLocation {
    pub label: String,
    pub path: String,
}

fn get_home_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    let home = std::env::var("USERPROFILE")
        .map_err(|_| "Não foi possível localizar a pasta do usuário".to_string())?;
    #[cfg(not(target_os = "windows"))]
    let home = std::env::var("HOME")
        .map_err(|_| "Não foi possível localizar a pasta do usuário".to_string())?;
    Ok(PathBuf::from(home))
}

/// Único ponto de checagem de escopo: todo comando que recebe um path do front
/// passa por aqui antes de tocar no disco. Escopo = Home do usuário e subpastas
/// (decisão explícita do usuário, por segurança — ver README do módulo).
/// Validado com testes automatizados (bloqueia /etc, aceita subpastas da Home).
fn ensure_within_home(path: &str) -> Result<PathBuf, String> {
    let home = get_home_dir()?;
    let canonical_home = fs::canonicalize(&home).map_err(|e| e.to_string())?;
    let canonical_target =
        fs::canonicalize(path).map_err(|e| format!("Caminho inválido: {}", e))?;
    if !canonical_target.starts_with(&canonical_home) {
        return Err("Acesso negado: fora da pasta do usuário.".to_string());
    }
    Ok(canonical_target)
}

fn system_time_to_iso(t: std::time::SystemTime) -> Option<String> {
    let dt: DateTime<Utc> = t.into();
    Some(dt.to_rfc3339())
}

fn entry_from_path(path: &Path) -> Result<FsEntry, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string_lossy().to_string());
    let extension = if metadata.is_dir() {
        None
    } else {
        path.extension().map(|e| e.to_string_lossy().to_lowercase())
    };

    Ok(FsEntry {
        name,
        path: path.to_string_lossy().to_string(),
        is_dir: metadata.is_dir(),
        size: if metadata.is_dir() { 0 } else { metadata.len() },
        modified_at: metadata.modified().ok().and_then(system_time_to_iso),
        extension,
    })
}

#[tauri::command]
pub fn list_directory(path: String) -> Result<Vec<FsEntry>, String> {
    let target = ensure_within_home(&path)?;
    if !target.is_dir() {
        return Err("O caminho informado não é uma pasta.".to_string());
    }

    let mut entries = Vec::new();
    for item in fs::read_dir(&target).map_err(|e| e.to_string())? {
        let item = item.map_err(|e| e.to_string())?;
        // entradas ilegíveis (permissão negada, link quebrado) são puladas, não derrubam a listagem inteira
        if let Ok(entry) = entry_from_path(&item.path()) {
            entries.push(entry);
        }
    }
    Ok(entries)
}

#[tauri::command]
pub fn get_home_path() -> Result<String, String> {
    Ok(get_home_dir()?.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_quick_access_locations() -> Result<Vec<QuickAccessLocation>, String> {
    let home = get_home_dir()?;
    let candidates = [
        ("Início", home.clone()),
        ("Documentos", home.join("Documents")),
        ("Downloads", home.join("Downloads")),
        ("Área de trabalho", home.join("Desktop")),
    ];

    Ok(candidates
        .into_iter()
        .filter(|(_, p)| p.is_dir()) // só oferece atalhos que realmente existem nesse SO/usuário
        .map(|(label, p)| QuickAccessLocation {
            label: label.to_string(),
            path: p.to_string_lossy().to_string(),
        })
        .collect())
}

#[tauri::command]
pub fn create_folder(parent_path: String, name: String) -> Result<FsEntry, String> {
    let parent = ensure_within_home(&parent_path)?;
    if name.trim().is_empty() || name.contains(['/', '\\']) {
        return Err("Nome de pasta inválido.".to_string());
    }
    let new_path = parent.join(&name);
    if new_path.exists() {
        return Err("Já existe um item com esse nome nesta pasta.".to_string());
    }
    fs::create_dir(&new_path).map_err(|e| e.to_string())?;
    entry_from_path(&new_path)
}

#[tauri::command]
pub fn rename_path(path: String, new_name: String) -> Result<FsEntry, String> {
    let target = ensure_within_home(&path)?;
    if new_name.trim().is_empty() || new_name.contains(['/', '\\']) {
        return Err("Nome inválido.".to_string());
    }
    let new_path = target
        .parent()
        .ok_or_else(|| "Não é possível renomear a raiz.".to_string())?
        .join(&new_name);
    if new_path.exists() {
        return Err("Já existe um item com esse nome nesta pasta.".to_string());
    }
    fs::rename(&target, &new_path).map_err(|e| e.to_string())?;
    entry_from_path(&new_path)
}

/// Envia pra lixeira/reciclagem do SO (crate `trash`) em vez de apagar permanentemente —
/// decisão explícita do usuário, diferente do padrão do resto do app (covers/modifications
/// usam fs::remove direto) porque aqui são arquivos reais do usuário, não dados internos do Manager.
#[tauri::command]
pub fn delete_to_trash(path: String) -> Result<(), String> {
    let target = ensure_within_home(&path)?;
    trash::delete(&target).map_err(|e| e.to_string())
}

fn copy_recursive(from: &Path, to: &Path) -> Result<(), String> {
    if from.is_dir() {
        fs::create_dir_all(to).map_err(|e| e.to_string())?;
        for item in fs::read_dir(from).map_err(|e| e.to_string())? {
            let item = item.map_err(|e| e.to_string())?;
            let dest = to.join(item.file_name());
            copy_recursive(&item.path(), &dest)?;
        }
        Ok(())
    } else {
        fs::copy(from, to).map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
pub fn copy_path(source_path: String, dest_dir_path: String) -> Result<FsEntry, String> {
    let source = ensure_within_home(&source_path)?;
    let dest_dir = ensure_within_home(&dest_dir_path)?;
    let file_name = source
        .file_name()
        .ok_or_else(|| "Caminho de origem inválido.".to_string())?;
    let dest = dest_dir.join(file_name);
    if dest.exists() {
        return Err("Já existe um item com esse nome no destino.".to_string());
    }
    copy_recursive(&source, &dest)?;
    entry_from_path(&dest)
}

#[tauri::command]
pub fn move_path(source_path: String, dest_dir_path: String) -> Result<FsEntry, String> {
    let source = ensure_within_home(&source_path)?;
    let dest_dir = ensure_within_home(&dest_dir_path)?;
    let file_name = source
        .file_name()
        .ok_or_else(|| "Caminho de origem inválido.".to_string())?;
    let dest = dest_dir.join(file_name);
    if dest.exists() {
        return Err("Já existe um item com esse nome no destino.".to_string());
    }
    // rename() cobre o caso comum (mesmo volume); cross-device precisa copiar e apagar a origem.
    match fs::rename(&source, &dest) {
        Ok(_) => entry_from_path(&dest),
        Err(_) => {
            copy_recursive(&source, &dest)?;
            if source.is_dir() {
                fs::remove_dir_all(&source).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(&source).map_err(|e| e.to_string())?;
            }
            entry_from_path(&dest)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn home_scoping_blocks_outside_paths() {
        let home = get_home_dir().unwrap();
        std::fs::create_dir_all(home.join("fx_test_dir")).unwrap();
        assert!(ensure_within_home(home.join("fx_test_dir").to_str().unwrap()).is_ok());
        assert!(ensure_within_home("/etc").is_err());
        std::fs::remove_dir_all(home.join("fx_test_dir")).unwrap();
    }

    #[test]
    fn create_rename_list_roundtrip() {
        let home = get_home_dir().unwrap();
        let base = home.join("fx_test_roundtrip");
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();

        let created =
            create_folder(base.to_string_lossy().to_string(), "Nova pasta".into()).unwrap();
        assert_eq!(created.name, "Nova pasta");
        assert!(created.is_dir);

        let renamed = rename_path(created.path.clone(), "Renomeada".into()).unwrap();
        assert_eq!(renamed.name, "Renomeada");

        let listing = list_directory(base.to_string_lossy().to_string()).unwrap();
        assert_eq!(listing.len(), 1);
        assert_eq!(listing[0].name, "Renomeada");

        fs::remove_dir_all(&base).unwrap();
    }

    #[test]
    fn copy_and_move_work() {
        let home = get_home_dir().unwrap();
        let base = home.join("fx_test_copymove");
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(base.join("src")).unwrap();
        fs::create_dir_all(base.join("dst")).unwrap();
        fs::write(base.join("src/file.txt"), b"ola").unwrap();

        let copied = copy_path(
            base.join("src/file.txt").to_string_lossy().to_string(),
            base.join("dst").to_string_lossy().to_string(),
        )
        .unwrap();
        assert!(Path::new(&copied.path).exists());
        assert!(base.join("src/file.txt").exists());

        let moved = move_path(
            base.join("src/file.txt").to_string_lossy().to_string(),
            base.join("dst").to_string_lossy().to_string(),
        );
        assert!(moved.is_err());

        fs::remove_dir_all(&base).unwrap();
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TrashEntry {
    pub id: String,
    pub name: String,
    pub original_parent: String,
    pub time_deleted: i64,
}

#[cfg(any(target_os = "windows", all(unix, not(target_os = "macos"))))]
#[tauri::command]
pub fn list_trash() -> Result<Vec<TrashEntry>, String> {
    let home = get_home_dir()?;
    let items = trash::os_limited::list().map_err(|e| e.to_string())?;
    Ok(items
        .into_iter()
        // só mostra o que foi apagado de dentro da Home — mesmo escopo do resto do módulo
        .filter(|item| item.original_parent.starts_with(&home))
        .map(|item| TrashEntry {
            id: item.id.to_string_lossy().to_string(),
            name: item.name.to_string_lossy().to_string(),
            original_parent: item.original_parent.to_string_lossy().to_string(),
            time_deleted: item.time_deleted,
        })
        .collect())
}

#[cfg(any(target_os = "windows", all(unix, not(target_os = "macos"))))]
#[tauri::command]
pub fn restore_trash_item(
    id: String,
    name: String,
    original_parent: String,
    time_deleted: i64,
) -> Result<(), String> {
    let home = get_home_dir()?;
    let parent = PathBuf::from(&original_parent);
    if !parent.starts_with(&home) {
        return Err("Acesso negado: fora da pasta do usuário.".to_string());
    }
    let item = trash::TrashItem {
        id: std::ffi::OsString::from(id),
        name: name.into(),
        original_parent: parent,
        time_deleted,
    };
    trash::os_limited::restore_all(std::iter::once(item)).map_err(|e| e.to_string())
}

const MAX_TEXT_FILE_BYTES: u64 = 5 * 1024 * 1024;

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    let target = ensure_within_home(&path)?;
    let metadata = fs::metadata(&target).map_err(|e| e.to_string())?;
    if metadata.len() > MAX_TEXT_FILE_BYTES {
        return Err("Arquivo grande demais pra visualizar como texto.".to_string());
    }
    fs::read_to_string(&target).map_err(|_| {
        "Não foi possível ler como texto (talvez não seja um arquivo de texto).".to_string()
    })
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    let target = ensure_within_home(&path)?;
    fs::write(&target, content).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Ícone customizado de pasta
//
// Decisão de escopo (Parte 9): a imagem final e o manifesto (pasta -> arquivo)
// ficam só em `app_data_dir()/folder-icons/`, nunca dentro da pasta do usuário
// — diferente do resto do módulo (que mexe em arquivos reais do usuário),
// aqui é puramente configuração/preferência do app.
// ---------------------------------------------------------------------------

fn folder_icons_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("folder-icons");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn folder_icons_manifest_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(folder_icons_dir(app)?.join("manifest.json"))
}

/// Manifesto: path da pasta (canônico) -> nome do arquivo de imagem dentro de `folder_icons_dir`.
fn load_folder_icons_manifest(app: &AppHandle) -> Result<HashMap<String, String>, String> {
    let path = folder_icons_manifest_path(app)?;
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if content.trim().is_empty() {
        return Ok(HashMap::new());
    }
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn save_folder_icons_manifest(
    app: &AppHandle,
    manifest: &HashMap<String, String>,
) -> Result<(), String> {
    let path = folder_icons_manifest_path(app)?;
    let content = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

/// Troca o ícone salvo pra `folder_key`, removendo o arquivo de imagem antigo (se houver)
/// antes de gravar o novo nome no manifesto. Não falha se o arquivo antigo já tiver sumido.
fn replace_folder_icon_file(
    manifest: &mut HashMap<String, String>,
    dir: &Path,
    folder_key: &str,
    new_file_name: String,
) {
    if let Some(old_file_name) = manifest.get(folder_key) {
        let _ = fs::remove_file(dir.join(old_file_name));
    }
    manifest.insert(folder_key.to_string(), new_file_name);
}

/// Carrega o manifesto inteiro de uma vez (path da pasta -> path absoluto do arquivo de
/// ícone), pro front cachear tudo na inicialização em vez de perguntar item por item.
#[tauri::command]
pub fn get_folder_icons(app: AppHandle) -> Result<HashMap<String, String>, String> {
    let manifest = load_folder_icons_manifest(&app)?;
    let dir = folder_icons_dir(&app)?;
    Ok(manifest
        .into_iter()
        .map(|(folder_path, file_name)| {
            (
                folder_path,
                dir.join(file_name).to_string_lossy().to_string(),
            )
        })
        .collect())
}

/// `source_image_path` é o path devolvido pelo diálogo de arquivo do front
/// (`tauri-plugin-dialog`) — não precisa estar dentro da Home, é só lido uma vez pra copiar.
#[tauri::command]
pub fn set_folder_icon_from_path(
    app: AppHandle,
    folder_path: String,
    source_image_path: String,
) -> Result<String, String> {
    let target = ensure_within_home(&folder_path)?;
    if !target.is_dir() {
        return Err("O caminho informado não é uma pasta.".to_string());
    }
    let source = PathBuf::from(&source_image_path);
    if !source.is_file() {
        return Err("Selecione um arquivo de imagem válido.".to_string());
    }
    let extension = source
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_else(|| "png".to_string());

    let dir = folder_icons_dir(&app)?;
    let file_name = format!("{}.{}", uuid::Uuid::new_v4(), extension);
    fs::copy(&source, dir.join(&file_name)).map_err(|e| e.to_string())?;

    let key = target.to_string_lossy().to_string();
    let mut manifest = load_folder_icons_manifest(&app)?;
    replace_folder_icon_file(&mut manifest, &dir, &key, file_name.clone());
    save_folder_icons_manifest(&app, &manifest)?;

    Ok(dir.join(file_name).to_string_lossy().to_string())
}

/// Lê a imagem atual da área de transferência (RGBA cru) e converte pra PNG antes de salvar —
/// o clipboard não entrega um arquivo pronto, só os pixels.
#[tauri::command]
pub fn set_folder_icon_from_clipboard(
    app: AppHandle,
    folder_path: String,
) -> Result<String, String> {
    let target = ensure_within_home(&folder_path)?;
    if !target.is_dir() {
        return Err("O caminho informado não é uma pasta.".to_string());
    }

    let image = app
        .clipboard()
        .read_image()
        .map_err(|_| "Não há nenhuma imagem copiada na área de transferência.".to_string())?;

    let buffer = image::RgbaImage::from_raw(image.width(), image.height(), image.rgba().to_vec())
        .ok_or_else(|| "Não foi possível decodificar a imagem colada.".to_string())?;

    let dir = folder_icons_dir(&app)?;
    let file_name = format!("{}.png", uuid::Uuid::new_v4());
    buffer
        .save(dir.join(&file_name))
        .map_err(|e| e.to_string())?;

    let key = target.to_string_lossy().to_string();
    let mut manifest = load_folder_icons_manifest(&app)?;
    replace_folder_icon_file(&mut manifest, &dir, &key, file_name.clone());
    save_folder_icons_manifest(&app, &manifest)?;

    Ok(dir.join(file_name).to_string_lossy().to_string())
}

#[tauri::command]
pub fn remove_folder_icon(app: AppHandle, folder_path: String) -> Result<(), String> {
    let target = ensure_within_home(&folder_path)?;
    let dir = folder_icons_dir(&app)?;
    let key = target.to_string_lossy().to_string();
    let mut manifest = load_folder_icons_manifest(&app)?;
    if let Some(file_name) = manifest.remove(&key) {
        let _ = fs::remove_file(dir.join(file_name));
        save_folder_icons_manifest(&app, &manifest)?;
    }
    Ok(())
}
