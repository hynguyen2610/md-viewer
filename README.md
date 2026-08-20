# md-viewer

A small desktop Markdown viewer: pick a folder, browse its `.md` / `.markdown`
files in a sidebar tree, click one to render it (GitHub-flavored Markdown,
tables, code highlighting). Built with **Tauri 2** (Rust) + **React 18** +
**TypeScript**.

## 1. Install platform prerequisites

### Linux Mint

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

### Windows 10 or 11

Install the following tools:

1. [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/).
   In the installer, select **Desktop development with C++**.
2. [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2/).
   It is already included with most current Windows installations.
3. [Rust](https://www.rust-lang.org/tools/install). Run `rustup-init.exe` and
   keep the default MSVC toolchain.
4. [Node.js](https://nodejs.org/) 18 or newer (the current LTS release is
   recommended).

After installation, open a new PowerShell window and verify the toolchain:

```powershell
rustc --version
cargo --version
node --version
npm --version
```

### macOS

Install Apple's command-line developer tools, then install Rust and Node.js:

```bash
xcode-select --install

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Node.js 18+ with Homebrew
brew install node
```

If Homebrew is not installed, install Node.js from
[nodejs.org](https://nodejs.org/) instead. Building requires macOS 10.13 or
newer.

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

Output binaries and installers land in `src-tauri/target/release/bundle/`:

| Platform | Typical output |
| --- | --- |
| Linux | `.deb`, `.rpm`, and `.AppImage` |
| Windows | `.msi` and NSIS `.exe` installer |
| macOS | `.app` bundle and `.dmg` disk image |

Build on the target operating system: create Windows installers on Windows,
macOS packages on macOS, and Linux packages on Linux.

### Install a local release

On Linux Mint, install the generated Debian package:

```bash
sudo apt install "$(pwd)"/src-tauri/target/release/bundle/deb/md-viewer_*_amd64.deb
```

On Windows, open the generated `.msi` or setup `.exe` and follow the installer.

On macOS, open the generated `.dmg`, then drag **md-viewer** into
**Applications**. Locally built, unsigned packages may require
**Control-click → Open** the first time. Public distribution requires Apple
code signing and notarization.

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
