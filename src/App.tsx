import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Sidebar, { DirNode, GitStatus } from "./components/Sidebar";
import MarkdownView from "./components/MarkdownView";

export type Theme = "light" | "dark";

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const [root, setRoot] = useState<DirNode | null>(null);
  const [rootLabel, setRootLabel] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rootPath, setRootPath] = useState<string | null>(null);
  const [gitStatuses, setGitStatuses] = useState<Record<string, GitStatus>>({});
  const selectedPathRef = useRef<string | null>(null);

  useEffect(() => {
    selectedPathRef.current = selectedPath;
  }, [selectedPath]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const refreshFolder = useCallback(async (path: string) => {
    const [tree, statuses] = await Promise.all([
      invoke<DirNode>("read_dir_tree", { path }),
      invoke<Array<{ path: string; status: GitStatus }>>("git_file_statuses", { path }),
    ]);
    setRoot(tree);
    setRootLabel(tree.name);
    setGitStatuses(Object.fromEntries(statuses.map((item) => [item.path, item.status])));

    const currentFile = selectedPathRef.current;
    if (currentFile) {
      try {
        setContent(await invoke<string>("read_file_content", { path: currentFile }));
      } catch {
        setSelectedPath(null);
        setContent(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!rootPath) return;
    const timer = window.setInterval(() => {
      void refreshFolder(rootPath).catch(() => undefined);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [rootPath, refreshFolder]);

  const handleChooseFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Choose a folder to browse",
    });

    if (!selected || Array.isArray(selected)) return;

    setError(null);
    try {
      await refreshFolder(selected);
      setRootPath(selected);
      setSelectedPath(null);
      setContent(null);
    } catch (e) {
      setError(`Could not read folder: ${String(e)}`);
    }
  }, [refreshFolder]);

  const handleSelectFile = useCallback(async (path: string) => {
    setSelectedPath(path);
    setLoading(true);
    setError(null);
    try {
      const text = await invoke<string>("read_file_content", { path });
      setContent(text);
    } catch (e) {
      setError(`Could not read file: ${String(e)}`);
      setContent(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const fileName = selectedPath ? selectedPath.split(/[\\/]/).pop() ?? null : null;

  return (
    <div className="app">
      <Sidebar
        root={root}
        rootLabel={rootLabel}
        selectedPath={selectedPath}
        onSelectFile={handleSelectFile}
        onChooseFolder={handleChooseFolder}
        gitStatuses={gitStatuses}
        theme={theme}
        onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")}
      />
      <main className="main-pane">
        <MarkdownView
          content={content}
          fileName={fileName}
          loading={loading}
          error={error}
          theme={theme}
        />
      </main>
    </div>
  );
}
