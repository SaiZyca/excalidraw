#[derive(serde::Deserialize)]
pub struct BatchImageItem {
    pub name: String,
    pub data: Vec<u8>,
}

#[tauri::command]
fn save_batch_images(dir_path: String, files: Vec<BatchImageItem>) -> Result<usize, String> {
    let path = std::path::Path::new(&dir_path);
    if !path.exists() {
        std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
    }
    let mut count = 0;
    for file in files {
        let file_path = path.join(&file.name);
        std::fs::write(&file_path, file.data).map_err(|e| e.to_string())?;
        count += 1;
    }
    Ok(count)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_batch_images])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

