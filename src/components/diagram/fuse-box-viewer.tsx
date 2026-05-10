"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Zap, Search, X, Maximize2, Minimize2, RotateCw, Grid3X3, List, ImageIcon,
  Radio, Lightbulb, Wrench, ArrowUpDown, ShieldCheck, Snowflake, Disc3, Droplets, Lock, Volume2, Fuel, Gauge, HelpCircle,
} from "lucide-react";
import type { FuseBox, FuseEntry, FuseIcon } from "@/types/diagnostic";

interface FuseBoxViewerProps {
  box: FuseBox;
}

const ampHex: Record<string, { fill: string; stroke: string; text: string; glow: string }> = {
  "5A": { fill: "#fb923c", stroke: "#c2410c", text: "#fff", glow: "#fb923c" },
  "7.5A": { fill: "#d97706", stroke: "#92400e", text: "#fff", glow: "#d97706" },
  "10A": { fill: "#ef4444", stroke: "#b91c1c", text: "#fff", glow: "#ef4444" },
  "15A": { fill: "#3b82f6", stroke: "#1d4ed8", text: "#fff", glow: "#3b82f6" },
  "20A": { fill: "#facc15", stroke: "#a16207", text: "#000", glow: "#facc15" },
  "25A": { fill: "#e7e5e4", stroke: "#a8a29e", text: "#000", glow: "#d6d3d1" },
  "30A": { fill: "#22c55e", stroke: "#15803d", text: "#fff", glow: "#22c55e" },
  "40A": { fill: "#f472b6", stroke: "#be185d", text: "#fff", glow: "#f472b6" },
};

function getAmp(amp: string) {
  const key = amp.replace(/\s/g, "").toUpperCase();
  for (const [k, v] of Object.entries(ampHex)) {
    if (key.startsWith(k) || key === k) return v;
  }
  return { fill: "#9ca3af", stroke: "#4b5563", text: "#fff", glow: "#9ca3af" };
}

const iconMap: Record<FuseIcon, typeof Radio> = {
  radio: Radio,
  light: Lightbulb,
  engine: Wrench,
  window: ArrowUpDown,
  airbag: ShieldCheck,
  ac: Snowflake,
  brake: Disc3,
  wiper: Droplets,
  lock: Lock,
  horn: Volume2,
  fuel: Fuel,
  abs: Gauge,
  other: HelpCircle,
};

function FuseIconEl({ icon, className }: { icon?: FuseIcon; className?: string }) {
  const Icon = icon ? iconMap[icon] || HelpCircle : null;
  if (!Icon) return null;
  return <Icon className={className || "h-3 w-3"} />;
}

function buildPositionMap(box: FuseBox) {
  const map = new Map<string, FuseEntry>();
  const hasPositions = box.fuses.some((f) => f.position);
  if (hasPositions) {
    for (const f of box.fuses) {
      if (f.position) map.set(`${f.position.row}-${f.position.col}`, f);
    }
  } else {
    const cols = box.grid?.cols || (box.fuses.length > 20 ? 8 : box.fuses.length > 10 ? 6 : 4);
    box.fuses.forEach((f, i) => {
      const row = Math.floor(i / cols) + 1;
      const col = (i % cols) + 1;
      map.set(`${row}-${col}`, { ...f, position: { row, col } });
    });
  }
  return map;
}

const PADDING = 12;
const CELL_W = 52;
const CELL_H = 28;

export function FuseBoxViewer({ box }: FuseBoxViewerProps) {
  const t = useTranslations("result.fuses");
  const [selected, setSelected] = useState<FuseEntry | null>(null);
  const [hovered, setHovered] = useState<FuseEntry | null>(null);
  const [search, setSearch] = useState("");
  const [fullScreen, setFullScreen] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [viewMode, setViewMode] = useState<"diagram" | "list" | "image">("diagram");
  const tableRef = useRef<HTMLDivElement>(null);
  const activeRowRef = useRef<HTMLButtonElement>(null);

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

  const svgW = PADDING * 2 + grid.cols * CELL_W;
  const svgH = PADDING * 2 + grid.rows * CELL_H;

  const highlighted = useMemo(() => {
    if (!search.trim()) return new Set<string>();
    const q = search.toLowerCase();
    return new Set(
      box.fuses.filter((f) =>
        f.number.toLowerCase().includes(q) ||
        f.circuit.toLowerCase().includes(q) ||
        f.amperage.toLowerCase().includes(q) ||
        f.protected_component?.toLowerCase().includes(q)
      ).map((f) => f.number)
    );
  }, [search, box.fuses]);

  const filtered = useMemo(() => {
    if (!search.trim()) return box.fuses;
    const q = search.toLowerCase();
    return box.fuses.filter((f) =>
      f.number.toLowerCase().includes(q) ||
      f.circuit.toLowerCase().includes(q) ||
      f.amperage.toLowerCase().includes(q) ||
      f.protected_component?.toLowerCase().includes(q)
    );
  }, [search, box.fuses]);

  const handleSelect = useCallback((fuse: FuseEntry | null) => {
    setSelected((prev) => (prev?.number === fuse?.number ? null : fuse));
  }, []);

  useEffect(() => {
    if (selected && activeRowRef.current) {
      activeRowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selected]);

  useEffect(() => {
    document.body.style.overflow = fullScreen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [fullScreen]);

  const diagramImageUrl = box.diagram_url || box.image_url;

  const renderFuseSVG = (fuse: FuseEntry, cx: number, cy: number) => {
    const c = getAmp(fuse.amperage);
    const isSel = selected?.number === fuse.number;
    const isHl = highlighted.has(fuse.number);
    const isDim = search.trim() && !isHl;
    const isHov = hovered?.number === fuse.number;
    const fuseType = fuse.type || "MINI";
    const isATO = fuseType === "ATO" || fuseType === "ATO_SHUNT";
    const isMaxi = fuseType === "MAXI" || fuseType === "JCASE";

    const fw = isMaxi ? 22 : isATO ? 20 : 18;
    const fh = isMaxi ? 12 : isATO ? 10 : 9;

    return (
      <g
        key={fuse.number}
        onClick={() => handleSelect(fuse)}
        onMouseEnter={() => setHovered(fuse)}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: "pointer", opacity: isDim ? 0.15 : 1 }}
      >
        {(isSel || isHov) && (
          <circle cx={cx} cy={cy} r={fw / 2 + 4} fill="none" stroke={c.glow} strokeWidth={2}>
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1.2s" repeatCount="indefinite" />
          </circle>
        )}
        {isHl && !isSel && !isHov && (
          <circle cx={cx} cy={cy} r={fw / 2 + 3} fill="none" stroke={c.glow} strokeWidth={1.5}>
            <animate attributeName="opacity" values="0.2;0.7;0.2" dur="1s" repeatCount="indefinite" />
          </circle>
        )}
        <rect x={cx - fw / 2} y={cy - fh / 2} width={fw} height={fh} rx={2} fill={c.fill} stroke={isSel ? "#fff" : c.stroke} strokeWidth={isSel ? 2 : 1} />
        {!isMaxi && !isATO && (
          <rect x={cx - fw * 0.3} y={cy - fh / 2 + 1.5} width={fw * 0.6} height={fh * 0.3} rx={1} fill={c.stroke} opacity={0.3} />
        )}
        {isATO && (
          <rect x={cx - fw * 0.35} y={cy - fh / 2 + 1} width={fw * 0.7} height={fh * 0.3} rx={1} fill={c.stroke} opacity={0.25} />
        )}
        <text x={cx} y={cy - 1} textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={7} fontWeight="bold" fontFamily="monospace">{fuse.number}</text>
        <text x={cx} y={cy + 6} textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={4.5} opacity={0.8}>{fuse.amperage}</text>
        {fuse.icon && (
          <text x={cx} y={cy + fh / 2 + 5} textAnchor="middle" dominantBaseline="middle" fontSize={4} fill={c.fill} opacity={0.7}>
            {fuse.icon === "radio" ? "♫" : fuse.icon === "light" ? "💡" : fuse.icon === "engine" ? "⚙" : fuse.icon === "window" ? "▲" : fuse.icon === "ac" ? "❄" : fuse.icon === "brake" ? "◉" : "•"}
          </text>
        )}
      </g>
    );
  };

  const renderTooltip = () => {
    const fuse = hovered || (selected && !hovered ? null : null);
    if (!hovered) return null;
    const c = getAmp(hovered.amperage);
    return (
      <foreignObject x={0} y={0} width={svgW} height={svgH} style={{ pointerEvents: "none" }}>
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: 8,
              transform: "translateX(-50%)",
              background: "#fff",
              color: "#000",
              borderRadius: 8,
              padding: "6px 10px",
              fontSize: 11,
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              maxWidth: 260,
              zIndex: 50,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ display: "inline-block", width: 12, height: 12, borderRadius: 2, backgroundColor: c.fill, border: `1px solid ${c.stroke}` }} />
              <strong style={{ fontFamily: "monospace" }}>{hovered.number}</strong>
              <span style={{ fontSize: 9, color: "#666" }}>{hovered.type || "MINI"} {hovered.amperage}</span>
            </div>
            <div style={{ fontSize: 10, lineHeight: 1.3 }}>{hovered.circuit}</div>
            {hovered.protected_component && (
              <div style={{ fontSize: 9, color: "#888", marginTop: 1 }}>{hovered.protected_component}</div>
            )}
          </div>
        </div>
      </foreignObject>
    );
  };

  const renderSVGDiagram = () => {
    const transform = rotation === 90 ? `rotate(90, ${svgW / 2}, ${svgH / 2})` : rotation === 180 ? `rotate(180, ${svgW / 2}, ${svgH / 2})` : rotation === 270 ? `rotate(270, ${svgW / 2}, ${svgH / 2})` : "";

    return (
      <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%" className="max-h-[380px]">
        <defs>
          <linearGradient id={`housing-${box.reference || "d"}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2a2a" />
            <stop offset="100%" stopColor="#1a1a1a" />
          </linearGradient>
          <filter id="slot-shadow">
            <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodColor="#000" floodOpacity={0.4} />
          </filter>
        </defs>
        <g transform={transform}>
          <rect x={0} y={0} width={svgW} height={svgH} rx={10} fill={`url(#housing-${box.reference || "d"})`} stroke="#444" strokeWidth={1.5} />
          <rect x={3} y={3} width={svgW - 6} height={svgH - 6} rx={8} fill="none" stroke="#333" strokeWidth={0.5} strokeDasharray="3,2" />
          {Array.from({ length: grid.rows }, (_, r) =>
            Array.from({ length: grid.cols }, (_, c) => {
              const key = `${r + 1}-${c + 1}`;
              const fuse = posMap.get(key);
              const x = PADDING + c * CELL_W;
              const y = PADDING + r * CELL_H;
              const cx = x + CELL_W / 2;
              const cy = y + CELL_H / 2;
              return (
                <g key={key}>
                  <rect x={x + 2} y={y + 2} width={CELL_W - 4} height={CELL_H - 4} rx={2} fill="#111" stroke="#2a2a2a" strokeWidth={0.5} filter="url(#slot-shadow)" />
                  {fuse && renderFuseSVG(fuse, cx, cy)}
                </g>
              );
            })
          )}
          <text x={PADDING} y={svgH - 5} fill="#555" fontSize={6} fontFamily="monospace">{box.reference || box.name}</text>
        </g>
        {renderTooltip()}
      </svg>
    );
  };

  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (diagramImageUrl) {
      setImgError(false);
      setImgSrc(`/api/proxy/image?url=${encodeURIComponent(diagramImageUrl)}`);
    }
  }, [diagramImageUrl]);

  const renderImageOverlay = () => {
    if (!diagramImageUrl) return null;
    if (imgError && !imgSrc?.startsWith("http")) {
      setImgSrc(diagramImageUrl);
      return null;
    }
    if (!imgSrc) return null;
    return (
      <div className="relative w-full rounded-lg overflow-hidden border border-border/50 bg-black">
        <img src={imgSrc} alt={box.name} className="w-full max-h-[350px] object-contain" crossOrigin="anonymous" referrerPolicy="no-referrer" onError={() => { if (!imgError) { setImgError(true); setImgSrc(diagramImageUrl); } }} />
        <svg className="absolute inset-0 w-full h-full" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="xMidYMid meet">
          {Array.from(posMap.entries()).map(([key, fuse]) => {
            const c = getAmp(fuse.amperage);
            const isSel = selected?.number === fuse.number;
            const isHl = highlighted.has(fuse.number);
            const [r, col] = key.split("-").map(Number);
            const cx = PADDING + (col - 0.5) * CELL_W;
            const cy = PADDING + (r - 0.5) * CELL_H;
            return (
              <g key={key} onClick={() => handleSelect(fuse)} onMouseEnter={() => setHovered(fuse)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
                {(isSel || isHl) && (
                  <circle cx={cx} cy={cy} r={12} fill="none" stroke={c.glow} strokeWidth={2}>
                    <animate attributeName="r" values="10;14;10" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle cx={cx} cy={cy} r={9} fill={c.fill} stroke={isSel ? "#fff" : c.stroke} strokeWidth={isSel ? 2 : 1} opacity={highlighted.size > 0 && !isHl ? 0.2 : 0.85} />
                <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="middle" fill={c.text} fontSize={5.5} fontWeight="bold" fontFamily="monospace">{fuse.number}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const renderSyncedTable = () => (
    <div ref={tableRef} className="rounded-lg border border-border/50 divide-y divide-border/20 max-h-[380px] overflow-y-auto">
      {(search.trim() ? filtered : box.fuses).map((fuse) => {
        const c = getAmp(fuse.amperage);
        const isSel = selected?.number === fuse.number;
        const isHl = highlighted.has(fuse.number);
        const isDim = search.trim() && !isHl;
        return (
          <button
            key={fuse.number}
            ref={isSel ? activeRowRef : undefined}
            onClick={() => handleSelect(fuse)}
            className={`w-full text-left p-2 flex items-center gap-2.5 transition-all ${isSel ? "bg-primary/10 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"} ${isDim ? "opacity-20" : "hover:bg-muted/30"}`}
          >
            <div className="flex-shrink-0 flex items-center gap-1.5">
              <div className="h-5 w-8 rounded-sm flex items-center justify-center" style={{ backgroundColor: c.fill, border: `1px solid ${c.stroke}` }}>
                <span className="font-mono text-[8px] font-bold" style={{ color: c.text }}>{fuse.number}</span>
              </div>
              <FuseIconEl icon={fuse.icon} className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium leading-tight">{fuse.circuit}</p>
              {fuse.protected_component && (
                <p className="text-[9px] text-muted-foreground leading-tight mt-0.5 truncate">{fuse.protected_component}</p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {fuse.type && (
                <span className="text-[8px] text-muted-foreground font-mono">{fuse.type}</span>
              )}
              <Badge variant="outline" className="font-mono text-[9px] px-1">{fuse.amperage}</Badge>
            </div>
          </button>
        );
      })}
    </div>
  );

  const renderDetailPanel = () => {
    if (!selected) return null;
    const c = getAmp(selected.amperage);
    return (
      <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 animate-slide-up">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: c.fill, color: c.text }}>
              <FuseIconEl icon={selected.icon} className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono font-bold text-sm">{selected.number}</span>
                <Badge variant="outline" className="font-mono text-[10px]">{selected.amperage}</Badge>
                {selected.type && <Badge variant="outline" className="text-[9px] font-mono">{selected.type}</Badge>}
              </div>
              <p className="text-xs font-medium mt-0.5">{selected.circuit}</p>
              {selected.protected_component && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {t("protects")}: <span className="text-foreground">{selected.protected_component}</span>
                </p>
              )}
              {selected.color && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Color: <span className="text-foreground">{selected.color}</span>
                </p>
              )}
            </div>
          </div>
          <button onClick={() => setSelected(null)} className="p-1 rounded hover:bg-muted">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  };

  const content = (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-sm leading-tight">{box.name}</h3>
            <p className="text-[10px] text-muted-foreground">{box.location}{box.reference ? ` (${box.reference})` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("search")} className="pl-7 h-7 text-[11px] w-36" />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2">
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Badge variant="outline" className="text-[9px] px-1.5">{box.fuses.length} {t("fuses")}</Badge>
          <div className="flex border rounded-md overflow-hidden">
            <Button variant={viewMode === "diagram" ? "secondary" : "ghost"} size="icon" className="h-6 w-6 rounded-none" onClick={() => setViewMode("diagram")} title={t("viewDiagram")}>
              <Grid3X3 className="h-3 w-3" />
            </Button>
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-6 w-6 rounded-none" onClick={() => setViewMode("list")} title={t("viewList")}>
              <List className="h-3 w-3" />
            </Button>
            {diagramImageUrl && (
              <Button variant={viewMode === "image" ? "secondary" : "ghost"} size="icon" className="h-6 w-6 rounded-none" onClick={() => setViewMode("image")} title={t("viewImage")}>
                <ImageIcon className="h-3 w-3" />
              </Button>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setRotation((r) => (r + 90) % 360)} title={t("rotate")}>
            <RotateCw className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFullScreen(!fullScreen)} title={t(fullScreen ? "exitFullscreen" : "fullscreen")}>
            {fullScreen ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 flex-col lg:flex-row">
        <div className="flex-1 min-w-0">
          {viewMode === "diagram" && (
            <div className="rounded-xl border border-border/50 overflow-hidden">{renderSVGDiagram()}</div>
          )}
          {viewMode === "image" && diagramImageUrl && renderImageOverlay()}
          {viewMode === "list" && (
            <div className="rounded-xl border border-border/50 overflow-hidden">{renderSyncedTable()}</div>
          )}
        </div>
        {viewMode !== "list" && (
          <div className="lg:w-72 w-full flex-shrink-0">{renderSyncedTable()}</div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {Object.entries(ampHex).map(([amp, color]) => {
          const count = box.fuses.filter((f) => getAmp(f.amperage).fill === color.fill).length;
          if (count === 0) return null;
          return (
            <div key={amp} className="flex items-center gap-0.5">
              <div className="h-2.5 w-5 rounded-sm" style={{ backgroundColor: color.fill, border: `1px solid ${color.stroke}` }} />
              <span className="text-[9px] text-muted-foreground">{amp}</span>
            </div>
          );
        })}
      </div>

      {renderDetailPanel()}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
          {content}
        </div>
      </div>
    );
  }

  return content;
}
