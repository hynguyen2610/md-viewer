use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Serialize)]
pub struct DirNode {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<DirNode>>,
}

#[derive(Serialize)]
pub struct GitFileStatus {
    path: String,
    status: String,
}

const SKIP_DIR_NAMES: &[&str] = &[
    "node_modules",
    "target",
    ".git",
    ".svn",
    ".hg",
    "dist",
    "build",
    ".idea",
    ".vscode",
];

const VIEWABLE_EXTENSIONS: &[&str] = &["md", "markdown", "mdx", "mmd", "mermaid"];

fn is_viewable_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| VIEWABLE_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn should_skip_dir(name: &str) -> bool {
    name.starts_with('.') || SKIP_DIR_NAMES.contains(&name)
}

/// Recursively scans a directory, keeping only sub-directories that (directly
/// or transitively) contain at least one Markdown file, plus the Markdown
/// files themselves. Entries are sorted: directories first, then files, both
/// alphabetically.
fn scan_dir(dir: &Path) -> Result<Vec<DirNode>, String> {
    let mut entries: Vec<DirNode> = Vec::new();

    let read_dir = fs::read_dir(dir).map_err(|e| format!("{}: {}", dir.display(), e))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let file_type = entry.file_type().map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();

        if file_type.is_dir() {
            if should_skip_dir(&name) {
                continue;
            }
            let children = scan_dir(&path)?;
            if children.is_empty() {
                // No markdown files anywhere under this folder; skip it
                // to keep the tree focused.
                continue;
            }
            entries.push(DirNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: true,
                children: Some(children),
            });
        } else if file_type.is_file() && is_viewable_file(&path) {
            entries.push(DirNode {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
            });
        }
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
    });

    Ok(entries)
}

#[tauri::command]
fn read_dir_tree(path: String) -> Result<DirNode, String> {
    let root_path = Path::new(&path);
    if !root_path.is_dir() {
        return Err(format!("{} is not a directory", path));
    }

    let children = scan_dir(root_path)?;
    let name = root_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    Ok(DirNode {
        name,
        path,
        is_dir: true,
        children: Some(children),
    })
}

#[tauri::command]
fn read_file_content(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("{}: {}", path, e))
}

#[tauri::command]
fn resolve_markdown_link(current_path: String, href: String) -> Result<String, String> {
    let link_path = href
        .split(['#', '?'])
        .next()
        .filter(|path| !path.is_empty())
        .ok_or_else(|| "Link does not point to a file".to_string())?;

    let decoded = percent_encoding::percent_decode_str(link_path)
        .decode_utf8()
        .map_err(|_| "Link contains invalid UTF-8".to_string())?;
    let linked = Path::new(decoded.as_ref());
    let resolved = if linked.is_absolute() {
        linked.to_path_buf()
    } else {
        Path::new(&current_path)
            .parent()
            .ok_or_else(|| "Current file has no parent directory".to_string())?
            .join(linked)
    };

    if !is_viewable_file(&resolved) {
        return Err("Link is not a supported Markdown file".to_string());
    }

    let canonical = resolved
        .canonicalize()
        .map_err(|e| format!("{}: {}", resolved.display(), e))?;
    if !canonical.is_file() {
        return Err(format!("{} is not a file", canonical.display()));
    }

    Ok(canonical.to_string_lossy().to_string())
}

#[tauri::command]
fn git_file_statuses(path: String) -> Result<Vec<GitFileStatus>, String> {
    let root = Path::new(&path);
    let output = Command::new("git")
        .args([
            "-C",
            &path,
            "status",
            "--porcelain=v1",
            "-z",
            "--untracked-files=all",
        ])
        .output()
        .map_err(|e| format!("Could not run git: {e}"))?;

    if !output.status.success() {
        // A folder that is not a Git repository simply has no Git decorations.
        return Ok(Vec::new());
    }

    let mut statuses = Vec::new();
    let records: Vec<&[u8]> = output.stdout.split(|byte| *byte == 0).collect();
    let mut index = 0;
    while index < records.len() {
        let record = records[index];
        if record.len() < 4 {
            index += 1;
            continue;
        }

        let code = String::from_utf8_lossy(&record[..2]);
        let relative = String::from_utf8_lossy(&record[3..]).to_string();
        let absolute: PathBuf = root.join(relative);
        let status = if code.as_ref() == "??" || code.contains('A') {
            "added"
        } else {
            "modified"
        };
        statuses.push(GitFileStatus {
            path: absolute.to_string_lossy().to_string(),
            status: status.to_string(),
        });

        // Rename/copy records contain a second NUL-delimited path.
        index += if code.contains('R') || code.contains('C') {
            2
        } else {
            1
        };
    }

    Ok(statuses)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            read_dir_tree,
            read_file_content,
            resolve_markdown_link,
            git_file_statuses
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
