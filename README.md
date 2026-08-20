# md-viewer

A small desktop Markdown viewer: pick a folder, browse its `.md` / `.markdown`
files in a sidebar tree, click one to render it (GitHub-flavored Markdown,
tables, code highlighting). Built with **Tauri 2** (Rust) + **React 18** +
**TypeScript**.

## 1. Install prerequisites on Linux Mint

Tauri needs the system WebKitGTK stack, build tools, Rust, and Node.

```bash
sudo apt update
sudo apt install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  librsvg2-dev \
  libayatana-appindicator3-dev \
  build-essential \
  curl \
  wget \
  file \
  pkg-config

# Rust (if you don't have it)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Node.js 18+ (via nvm is easiest)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source "$HOME/.bashrc"
nvm install --lts

# Tauri CLI (project already depends on @tauri-apps/cli, but a global helps too)
cargo install tauri-cli --version "^2"
```

> Mint 21.x / 22.x are Ubuntu-based, so `libwebkit2gtk-4.1-dev` is the right
> package name on current releases. If `apt` can't find it, run
> `apt search webkit2gtk` and use whatever `4.0`/`4.1` dev package your
> release ships.

## 2. Install JS dependencies

```bash
cd md-viewer
npm install
```

## 3. Run it in dev mode

```bash
npm run tauri dev
```

This starts the Vite dev server and opens the native window. Click the 📂
button in the sidebar header, pick any folder, and any Markdown files inside
it (recursively, skipping `node_modules`, `.git`, `target`, `dist`, etc.)
will show up in the tree.

## 4. Build a release binary

```bash
npm run tauri build
```

Output binaries/installers land in `src-tauri/target/release/bundle/`
(an `.AppImage` and a `.deb` on Linux).

## How it's structured

- `src/` — React/TypeScript frontend
  - `App.tsx` — top-level state: current tree, selected file, content
  - `components/Sidebar.tsx` — recursive collapsible file tree
  - `components/MarkdownView.tsx` — renders markdown via `react-markdown` +
    `remark-gfm` (tables, task lists, strikethrough) + `rehype-highlight`
    (code block syntax highlighting)
  - `styles.css` — dark theme
- `src-tauri/` — Rust backend
  - `src/lib.rs` — two commands:
    - `read_dir_tree(path)` walks a directory recursively in Rust (fast,
      no per-file IPC round trip) and returns only folders that contain
      Markdown files plus the Markdown files themselves
    - `read_file_content(path)` reads a file's text content
  - `capabilities/default.json` — Tauri v2 permission grants for the
    dialog (folder picker) and fs plugins

The icons in `src-tauri/icons/` are auto-generated placeholders — swap them
for your own and re-run `npm run tauri icon path/to/source.png` if you want
a custom app icon.

## Sample content

A `sample-notes/` folder with a couple of `.md` files is included so you
have something to open on first run.
