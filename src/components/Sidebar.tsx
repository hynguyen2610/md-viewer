import { useState } from "react";
import type { Theme } from "../App";

export interface DirNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: DirNode[] | null;
}

export type GitStatus = "added" | "modified";

interface SidebarProps {
  root: DirNode | null;
  rootLabel: string;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onChooseFolder: () => void;
  gitStatuses: Record<string, GitStatus>;
  theme: Theme;
  onToggleTheme: () => void;
}

export default function Sidebar({
  root,
  rootLabel,
  selectedPath,
  onSelectFile,
  onChooseFolder,
  gitStatuses,
  theme,
  onToggleTheme,
}: SidebarProps) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title" title={rootLabel}>
          {rootLabel || "No folder open"}
        </span>
        <div className="sidebar-actions">
          <button className="icon-btn" onClick={onToggleTheme} title={`Use ${theme === "dark" ? "light" : "dark"} theme`}>
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <button className="icon-btn" onClick={onChooseFolder} title="Open folder">
            📂
          </button>
        </div>
      </div>
      <div className="sidebar-tree">
        {root ? (
          <TreeNode
            node={root}
            depth={0}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
            gitStatuses={gitStatuses}
          />
        ) : (
          <div className="sidebar-empty">
            Open a folder to browse Markdown files.
          </div>
        )}
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelectFile,
  gitStatuses,
}: {
  node: DirNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  gitStatuses: Record<string, GitStatus>;
}) {
  const [open, setOpen] = useState(depth < 1);

  if (node.is_dir) {
    const children = node.children ?? [];
    return (
      <div>
        <div
          className="tree-row tree-dir"
          style={{ paddingLeft: 10 + depth * 14 }}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={`chevron ${open ? "open" : ""}`}>▶</span>
          <span className="folder-icon">{open ? "📂" : "📁"}</span>
          <span className="tree-label">{node.name}</span>
        </div>
        {open && (
          <div>
            {children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                gitStatuses={gitStatuses}
              />
            ))}
            {children.length === 0 && (
              <div
                className="tree-row tree-empty"
                style={{ paddingLeft: 10 + (depth + 1) * 14 }}
              >
                empty
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const isSelected = node.path === selectedPath;
  const gitStatus = gitStatuses[node.path];
  return (
    <div
      className={`tree-row tree-file ${isSelected ? "selected" : ""} ${gitStatus ? `git-${gitStatus}` : ""}`}
      style={{ paddingLeft: 10 + depth * 14 + 16 }}
      onClick={() => onSelectFile(node.path)}
    >
      <span className="file-icon">📄</span>
      <span className="tree-label">{node.name}</span>
      {gitStatus && <span className="git-marker" title={`Git: ${gitStatus}`}>●</span>}
    </div>
  );
}
