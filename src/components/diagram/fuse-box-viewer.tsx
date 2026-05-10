"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Zap, Search, X, Maximize2, Minimize2, RotateCw, Grid3X3, List, ImageIcon } from "lucide-react";
import type { FuseBox, FuseEntry } from "@/types/diagnostic";

interface FuseBoxViewerProps {
  box: FuseBox;
}

const ampHexColors: Record<string, { fill: string; stroke: string; text: string; glow: string }> = {
  "5A": { fill: "#fb923c", stroke: "#ea580c", text: "#ffffff", glow: "#fb923c" },
  "7.5A": { fill: "#d97706", stroke: "#b45309", text: "#ffffff", glow: "#d97706" },
  "10A": { fill: "#ef4444", stroke: "#dc2626", text: "#ffffff", glow: "#ef4444" },
  "15A": { fill: "#3b82f6", stroke: "#2563eb", text: "#ffffff", glow: "#3b82f6" },
  "20A": { fill: "#facc15", stroke: "#eab308", text: "#000000", glow: "#facc15" },
  "25A": { fill: "#f5f5f4", stroke: "#d6d3d1", text: "#000000", glow: "#d6d3d1" },
  "30A": { fill: "#22c55e", stroke: "#16a34a", text: "#ffffff", glow: "#22c55e" },
  "40A": { fill: "#f472b6", stroke: "#ec4899", text: "#ffffff", glow: "#f472b6" },
};

const ampTailwind: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  "5A": { bg: "bg-orange-400", border: "border-orange-500", text: "text-white", glow: "shadow-orange-400/50" },
  "7.5A": { bg: "bg-amber-600", border: "border-amber-700", text: "text-white", glow: "shadow-amber-600/50" },
  "10A": { bg: "bg-red-500", border: "border-red-600", text: "text-white", glow: "shadow-red-500/50" },
  "15A": { bg: "bg-blue-500", border: "border-blue-600", text: "text-white", glow: "shadow-blue-500/50" },
  "20A": { bg: "bg-yellow-400", border: "border-yellow-500", text: "text-black", glow: "shadow-yellow-400/50" },
  "25A": { bg: "bg-white", border: "border-gray-300", text: "text-black", glow: "shadow-gray-300/50" },
  "30A": { bg: "bg-green-500", border: "border-green-600", text: "text-white", glow: "shadow-green-500/50" },
  "40A": { bg: "bg-pink-400", border: "border-pink-500", text: "text-white", glow: "shadow-pink-400/50" },
};

function getAmpHex(amp: string) {
  const key = amp.replace(/\s/g, "").toUpperCase();
  for (const [k, v] of Object.entries(ampHexColors)) {
    if (key.startsWith(k) || key === k) return v;
  }
  return { fill: "#9ca3af", stroke: "#6b7280", text: "#ffffff", glow: "#9ca3af" };
}

function getAmpTw(amp: string) {
  const key = amp.replace(/\s/g, "").toUpperCase();
  for (const [k, v] of Object.entries(ampTailwind)) {
    if (key.startsWith(k) || key === k) return v;
  }
  return { bg: "bg-gray-400", border: "border-gray-500", text: "text-white", glow: "shadow-gray-400/50" };
}

function buildPositionMap(box: FuseBox) {
  const map = new Map<string, FuseEntry>();
  const hasPositions = box.fuses.some((f) => f.position);
  if (hasPositions) {
    for (const f of box.fuses) {
      if (f.position) map.set(`${f.position.row}-${f.position.col}`, f);
    }
  } else {
    const grid = box.grid || {
      rows: Math.ceil(box.fuses.length / (box.fuses.length > 20 ? 8 : box.fuses.length > 10 ? 6 : 4)),
      cols: box.fuses.length > 20 ? 8 : box.fuses.length > 10 ? 6 : 4,
    };
    box.fuses.forEach((f, i) => {
      const row = Math.floor(i / grid.cols) + 1;
      const col = (i % grid.cols) + 1;
      map.set(`${row}-${col}`, { ...f, position: { row, col } });
    });
  }
  return map;
}

const SVG_PADDING = 16;
const CELL_W = 56;
const CELL_H = 32;
const FUSE_RX = 4;

export function FuseBoxViewer({ box }: FuseBoxViewerProps) {
  const t = useTranslations("result.fuses");
  const [selected, setSelected] = useState<FuseEntry | null>(null);
  const [search, setSearch] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [viewMode, setViewMode] = useState<"diagram" | "list" | "image">("diagram");
  const containerRef = useRef<HTMLDivElement>(null);

  const posMap = useMemo(() => buildPositionMap(box), [box]);
  const grid = useMemo(() => {
    if (box.grid) return box.grid;
    let maxRow = 0, maxCol = 0;
    posMap.forEach((_, key) => {
      const [r, c] = key.split("-").map(Number);
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
    });
    return { rows: maxRow, cols: maxCol };
  }, [box, posMap]);

  const svgW = SVG_PADDING * 2 + grid.cols * CELL_W;
  const svgH = SVG_PADDING * 2 + grid.rows * CELL_H;

  const highlighted = useMemo(() => {
    if (!search.trim()) return new Set<string>();
    const q = search.toLowerCase();
    return new Set(
      box.fuses
        .filter(
          (f) =>
            f.number.toLowerCase().includes(q) ||
            f.circuit.toLowerCase().includes(q) ||
            f.amperage.toLowerCase().includes(q) ||
            f.protected_component?.toLowerCase().includes(q)
        )
        .map((f) => f.number)
    );
  }, [search, box.fuses]);

  const filtered = useMemo(() => {
    if (!search.trim()) return box.fuses;
    const q = search.toLowerCase();
    return box.fuses.filter(
      (f) =>
        f.number.toLowerCase().includes(q) ||
        f.circuit.toLowerCase().includes(q) ||
        f.amperage.toLowerCase().includes(q) ||
        f.protected_component?.toLowerCase().includes(q)
    );
  }, [search, box.fuses]);

  const handleFuseClick = useCallback((fuse: FuseEntry | null) => {
    setSelected((prev) => (prev?.number === fuse?.number ? null : fuse));
  }, []);

  useEffect(() => {
    if (fullScreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [fullScreen]);

  const diagramImageUrl = box.diagram_url || box.image_url;

  const renderFuseSVG = (fuse: FuseEntry, x: number, y: number, w: number, h: number) => {
    const c = getAmpHex(fuse.amperage);
    const isSelected = selected?.number === fuse.number;
    const isHighlighted = highlighted.has(fuse.number);
    const isDimmed = search.trim() && !isHighlighted;
    const fuseType = fuse.type || "MINI";
    const isATO = fuseType === "ATO" || fuseType === "ATO_SHUNT";
    const isMaxi = fuseType === "MAXI" || fuseType === "JCASE";

    const fw = isMaxi ? w * 0.9 : w * 0.85;
    const fh = isMaxi ? h * 0.95 : isATO ? h * 0.88 : h * 0.78;
    const fx = x + (w - fw) / 2;
    const fy = y + (h - fh) / 2;

    return (
      <g
        key={fuse.number}
        onClick={() => handleFuseClick(fuse)}
        style={{ cursor: "pointer", opacity: isDimmed ? 0.2 : 1 }}
        className="transition-all duration-200"
      >
        {isSelected && (
          <rect x={fx - 4} y={fy - 4} width={fw + 8} height={fh + 8} rx={FUSE_RX + 2} fill="none" stroke={c.glow} strokeWidth={2.5}>
            <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
          </rect>
        )}
        {isHighlighted && !isSelected && (
          <rect x={fx - 3} y={fy - 3} width={fw + 6} height={fh + 6} rx={FUSE_RX + 1} fill="none" stroke={c.glow} strokeWidth={2}>
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.2s" repeatCount="indefinite" />
          </rect>
        )}
        <rect
          x={fx}
          y={fy}
          width={fw}
          height={fh}
          rx={FUSE_RX}
          fill={c.fill}
          stroke={isSelected ? "#ffffff" : c.stroke}
          strokeWidth={isSelected ? 2.5 : 1.5}
          className="hover:brightness-110"
        />
        {isATO && (
          <rect x={fx + fw * 0.35} y={fy + 1} width={fw * 0.3} height={fh * 0.35} rx={1.5} fill={c.stroke} opacity={0.3} />
        )}
        {!isMaxi && !isATO && (
          <rect x={fx + fw * 0.2} y={fy + 2} width={fw * 0.6} height={fh * 0.25} rx={1} fill={c.stroke} opacity={0.25} />
        )}
        {isMaxi && (
          <>
            <rect x={fx + fw * 0.15} y={fy + 2} width={fw * 0.25} height={fh * 0.4} rx={1} fill={c.stroke} opacity={0.2} />
            <rect x={fx + fw * 0.6} y={fy + 2} width={fw * 0.25} height={fh * 0.4} rx={1} fill={c.stroke} opacity={0.2} />
          </>
        )}
        <text
          x={x + w / 2}
          y={y + h / 2 - 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={c.text}
          fontSize={fw > 40 ? 8 : 6}
          fontWeight="bold"
          fontFamily="monospace"
        >
          {fuse.number}
        </text>
        <text
          x={x + w / 2}
          y={y + h / 2 + 7}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={c.text}
          fontSize={5}
          opacity={0.8}
        >
          {fuse.amperage}
        </text>
      </g>
    );
  };

  const renderDiagram = () => {
    const transform = rotation === 90 ? `rotate(90, ${svgW / 2}, ${svgH / 2})` : rotation === 180 ? `rotate(180, ${svgW / 2}, ${svgH / 2})` : rotation === 270 ? `rotate(270, ${svgW / 2}, ${svgH / 2})` : "";

    return (
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        width="100%"
        height="100%"
        className="max-h-[400px]"
        style={{ transform: rotation ? undefined : undefined }}
      >
        <defs>
          <filter id={`glow-${box.reference || box.name.replace(/\s/g, "")}`}>
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`box-bg-${box.reference || "default"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e1e2e" stopOpacity={0.6} />
            <stop offset="100%" stopColor="#0f0f1a" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <g transform={transform}>
          <rect x={0} y={0} width={svgW} height={svgH} rx={12} fill={`url(#box-bg-${box.reference || "default"})`} stroke="#333" strokeWidth={1.5} />
          <rect x={4} y={4} width={svgW - 8} height={svgH - 8} rx={10} fill="none" stroke="#444" strokeWidth={0.5} strokeDasharray="4,2" />
          {Array.from({ length: grid.rows }, (_, r) =>
            Array.from({ length: grid.cols }, (_, c) => {
              const key = `${r + 1}-${c + 1}`;
              const fuse = posMap.get(key);
              const x = SVG_PADDING + c * CELL_W;
              const y = SVG_PADDING + r * CELL_H;
              return (
                <g key={key}>
                  <rect
                    x={x + 2}
                    y={y + 2}
                    width={CELL_W - 4}
                    height={CELL_H - 4}
                    rx={3}
                    fill="#1a1a2e"
                    stroke="#2a2a3e"
                    strokeWidth={0.5}
                  />
                  {fuse && renderFuseSVG(fuse, x, y, CELL_W, CELL_H)}
                </g>
              );
            })
          )}
          <text x={SVG_PADDING} y={svgH - 4} fill="#666" fontSize={7} fontFamily="monospace">{box.reference || box.name}</text>
        </g>
      </svg>
    );
  };

  const renderImageOverlay = () => {
    if (!diagramImageUrl) return null;
    const proxyUrl = `/api/proxy/image?url=${encodeURIComponent(diagramImageUrl)}`;
    return (
      <div className="relative w-full rounded-lg overflow-hidden border border-border/50">
        <img src={proxyUrl} alt={box.name} className="w-full max-h-[300px] object-contain bg-muted" />
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
          {Array.from(posMap.entries()).map(([key, fuse]) => {
            const c = getAmpHex(fuse.amperage);
            const isSelected = selected?.number === fuse.number;
            const isHighlighted = highlighted.has(fuse.number);
            const [r, col] = key.split("-").map(Number);
            const cx = SVG_PADDING + (col - 0.5) * CELL_W;
            const cy = SVG_PADDING + (r - 0.5) * CELL_H;
            return (
              <g key={key} onClick={() => handleFuseClick(fuse)} style={{ cursor: "pointer" }}>
                {(isSelected || isHighlighted) && (
                  <circle cx={cx} cy={cy} r={14} fill="none" stroke={c.glow} strokeWidth={2}>
                    <animate attributeName="r" values="12;16;12" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  cx={cx}
                  cy={cy}
                  r={10}
                  fill={c.fill}
                  stroke={isSelected ? "#fff" : c.stroke}
                  strokeWidth={isSelected ? 2 : 1}
                  opacity={highlighted.size > 0 && !isHighlighted ? 0.2 : 0.85}
                  className="hover:opacity-100"
                />
                <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={6} fontWeight="bold" fontFamily="monospace">
                  {fuse.number}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const content = (
    <div className="space-y-3" ref={containerRef}>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{box.name}</h3>
            <p className="text-xs text-muted-foreground">
              {box.location}
              {box.reference ? ` (${box.reference})` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="pl-8 h-8 text-xs w-44"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Badge variant="outline" className="text-[10px]">
            {box.fuses.length} {t("fuses")}
          </Badge>
          <div className="flex border rounded-md overflow-hidden">
            <Button
              variant={viewMode === "diagram" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-none"
              onClick={() => setViewMode("diagram")}
              title={t("viewDiagram")}
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7 rounded-none"
              onClick={() => setViewMode("list")}
              title={t("viewList")}
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            {diagramImageUrl && (
              <Button
                variant={viewMode === "image" ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7 rounded-none"
                onClick={() => setViewMode("image")}
                title={t("viewImage")}
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRotation((r) => (r + 90) % 360)} title={t("rotate")}>
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullScreen(!fullScreen)} title={t(fullScreen ? "exitFullscreen" : "fullscreen")}>
            {fullScreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {viewMode === "diagram" && (
        <div className="rounded-xl border border-border/50 bg-muted/10 overflow-hidden">
          {renderDiagram()}
        </div>
      )}

      {viewMode === "image" && diagramImageUrl && renderImageOverlay()}

      {viewMode === "list" && (
        <div className="rounded-xl border border-border/50 divide-y divide-border/30 max-h-[350px] overflow-y-auto">
          {(search.trim() ? filtered : box.fuses).map((fuse) => {
            const tw = getAmpTw(fuse.amperage);
            const isSelected = selected?.number === fuse.number;
            const isHighlighted = highlighted.has(fuse.number);
            const isDimmed = search.trim() && !isHighlighted;
            return (
              <button
                key={fuse.number}
                onClick={() => handleFuseClick(fuse)}
                className={`w-full text-left p-2.5 flex items-center gap-3 transition-all hover:bg-muted/30 ${isSelected ? "bg-primary/10" : ""} ${isDimmed ? "opacity-30" : ""}`}
              >
                <div className={`h-7 w-10 rounded flex items-center justify-center flex-shrink-0 ${tw.bg} ${tw.text} border ${tw.border}`}>
                  <span className="font-mono text-[9px] font-bold">{fuse.number}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{fuse.circuit}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {fuse.amperage} {fuse.protected_component ? `• ${fuse.protected_component}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {fuse.type && (
                    <Badge variant="outline" className="text-[8px] font-mono px-1">
                      {fuse.type}
                    </Badge>
                  )}
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {fuse.amperage}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 items-center">
        {Object.entries(ampHexColors).map(([amp, color]) => {
          const count = box.fuses.filter((f) => getAmpHex(f.amperage).fill === color.fill).length;
          if (count === 0) return null;
          return (
            <div key={amp} className="flex items-center gap-1">
              <div className="h-3 w-6 rounded-sm" style={{ backgroundColor: color.fill, border: `1px solid ${color.stroke}` }} />
              <span className="text-[10px] text-muted-foreground">{amp}</span>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 animate-slide-up">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: getAmpHex(selected.amperage).fill, color: getAmpHex(selected.amperage).text }}
              >
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{selected.number}</span>
                  <Badge variant="outline" className="font-mono text-xs">{selected.amperage}</Badge>
                  {selected.type && (
                    <Badge variant="outline" className="text-[10px] font-mono">{selected.type}</Badge>
                  )}
                </div>
                <p className="text-sm font-medium mt-1">{selected.circuit}</p>
                {selected.protected_component && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("protects")}: <span className="text-foreground">{selected.protected_component}</span>
                  </p>
                )}
                {selected.color && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Color: <span className="text-foreground">{selected.color}</span>
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-muted">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
