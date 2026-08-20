import {
  memo,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent,
  type WheelEvent,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import mermaid from "mermaid";
import type { Theme } from "../App";

function MermaidDiagram({ chart, theme }: { chart: string; theme: Theme }) {
  const reactId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ pointerId: -1, x: 0, y: 0 });
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let active = true;
    mermaid.initialize({
      startOnLoad: false,
      theme: theme === "dark" ? "dark" : "default",
      securityLevel: "strict",
    });
    mermaid.render(`mermaid-${reactId}`, chart).then(({ svg }) => {
      if (active) {
        setSvg(svg);
        setError("");
      }
    }).catch((reason) => {
      if (active) setError(String(reason));
    });
    return () => { active = false; };
  }, [chart, reactId, theme]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const zoomBy = (amount: number) => {
    setScale((current) => Math.min(40, Math.max(0.25, current + amount)));
  };

  const resetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  const toggleFullscreen = async () => {
    if (document.fullscreenElement === containerRef.current) {
      await document.exitFullscreen();
    } else {
      await containerRef.current?.requestFullscreen();
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    dragRef.current.x = event.clientX;
    dragRef.current.y = event.clientY;
    setPosition((current) => ({ x: current.x + dx, y: current.y + dy }));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current.pointerId = -1;
    setDragging(false);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomBy(event.deltaY < 0 ? 0.1 : -0.1);
  };

  if (error) return <pre className="mermaid-error">Mermaid error: {error}</pre>;
  return (
    <div ref={containerRef} className="mermaid-container">
      <div className="mermaid-toolbar">
        <button type="button" onClick={() => zoomBy(-0.2)} title="Zoom out">−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button type="button" onClick={() => zoomBy(0.2)} title="Zoom in">+</button>
        <button type="button" onClick={resetView} title="Reset view">Reset</button>
        <button type="button" onClick={() => void toggleFullscreen()} title="Toggle fullscreen">
          {fullscreen ? "Exit fullscreen" : "Fullscreen"}
        </button>
      </div>
      <div
        className={`mermaid-viewport ${dragging ? "dragging" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      >
        <div
          className="mermaid-diagram"
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}

interface MarkdownViewProps {
  content: string | null;
  fileName: string | null;
  loading: boolean;
  error: string | null;
  theme: Theme;
  onOpenMarkdownLink: (href: string) => void;
}

function MarkdownView({
  content,
  fileName,
  loading,
  error,
  theme,
  onOpenMarkdownLink,
}: MarkdownViewProps) {
  if (loading) {
    return <div className="viewer-status">Loading…</div>;
  }

  if (error) {
    return <div className="viewer-status viewer-error">{error}</div>;
  }

  if (content === null) {
    return (
      <div className="viewer-status">
        Select a Markdown file from the sidebar to preview it here.
      </div>
    );
  }

  const isMermaidFile = fileName ? /\.(mmd|mermaid)$/i.test(fileName) : false;

  return (
    <div className="viewer">
      {fileName && <div className="viewer-filename">{fileName}</div>}
      <div className="markdown-body">
        {isMermaidFile ? <MermaidDiagram chart={content} theme={theme} /> : <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[[rehypeHighlight, { plainText: ["mermaid"] }]]}
          components={{
            a({ href, children, ...props }) {
              const isMarkdownLink = href
                && !/^[a-z][a-z\d+.-]*:/i.test(href)
                && /\.(?:md|markdown|mdx|mmd|mermaid)(?:[?#]|$)/i.test(href);
              const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
                if (!isMarkdownLink || event.button !== 0 || event.metaKey
                  || event.ctrlKey || event.shiftKey || event.altKey) return;
                event.preventDefault();
                onOpenMarkdownLink(href);
              };
              return <a href={href} onClick={handleClick} {...props}>{children}</a>;
            },
            pre({ children, ...props }) {
              if (isValidElement(children) && children.type === MermaidDiagram) {
                return children;
              }
              return <pre {...props}>{children}</pre>;
            },
            code({ className, children, ...props }) {
              if (className?.split(/\s+/).includes("language-mermaid")) {
                return <MermaidDiagram chart={String(children).replace(/\n$/, "")} theme={theme} />;
              }
              return <code className={className} {...props}>{children}</code>;
            },
          }}
        >
          {content}
        </ReactMarkdown>}
      </div>
    </div>
  );
}

export default memo(MarkdownView);
