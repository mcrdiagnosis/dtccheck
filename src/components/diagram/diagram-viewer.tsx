"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  MapPin,
  Zap,
  X,
  ChevronRight,
} from "lucide-react";
import type { DiagramAnalysis, DiagramAnnotation } from "@/types/diagnostic";

interface DiagramViewerProps {
  analysis: DiagramAnalysis;
  imageBase64?: string;
  imageUrl?: string;
}

const typeIcons: Record<string, string> = {
  component: "⚙️",
  fuse: "🔌",
  connector: "🔗",
  ground: "⏚",
  sensor: "📡",
  actuator: "🔧",
  ecu: "💻",
  relay: "⚡",
};

const typeColors: Record<string, string> = {
  component: "bg-blue-500",
  fuse: "bg-amber-500",
  connector: "bg-purple-500",
  ground: "bg-gray-500",
  sensor: "bg-emerald-500",
  actuator: "bg-red-500",
  ecu: "bg-indigo-500",
  relay: "bg-orange-500",
};

export function DiagramViewer({ analysis, imageBase64, imageUrl }: DiagramViewerProps) {
  const tr = useTranslations("result");
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedAnnotation, setSelectedAnnotation] = useState<DiagramAnnotation | null>(null);
  const [highlightPath, setHighlightPath] = useState(false);
  const [activePathIndex, setActivePathIndex] = useState(-1);

  const imgSrc = imageBase64
    ? `data:image/jpeg;base64,${imageBase64}`
    : imageUrl || "";

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale((prev) => Math.min(Math.max(prev + (e.deltaY > 0 ? -0.1 : 0.1), 0.5), 5));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    setTranslate({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const resetView = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const startPathAnimation = () => {
    if (!analysis.path_to_follow?.length) return;
    setHighlightPath(true);
    setActivePathIndex(0);
  };

  useEffect(() => {
    if (!highlightPath || activePathIndex < 0) return;
    if (activePathIndex >= (analysis.path_to_follow?.length || 0)) return;

    const timer = setTimeout(() => {
      setActivePathIndex((prev) => prev + 1);
    }, 1200);

    return () => clearTimeout(timer);
  }, [highlightPath, activePathIndex, analysis.path_to_follow]);

  const getPathAnnotation = (ref: string) => {
    return analysis.annotations.find(
      (a) =>
        a.label.toLowerCase().includes(ref.toLowerCase()) ||
        a.details?.toLowerCase().includes(ref.toLowerCase())
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setScale((s) => Math.min(s + 0.3, 5))}>
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setScale((s) => Math.max(s - 0.3, 0.5))}>
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" className="gap-1" onClick={resetView}>
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        {analysis.path_to_follow?.length > 0 && (
          <Button
            variant={highlightPath ? "default" : "outline"}
            size="sm"
            className="gap-1"
            onClick={startPathAnimation}
          >
            <ChevronRight className="h-3.5 w-3.5" />
            {tr("diagram.followPath")} ({analysis.path_to_follow.length})
          </Button>
        )}
        <div className="flex gap-1 ml-auto">
          {Object.entries(typeIcons).map(([type, icon]) => {
            const count = analysis.annotations?.filter((a) => a.type === type).length || 0;
            if (count === 0) return null;
            return (
              <span key={type} className="text-xs text-muted-foreground" title={`${type}: ${count}`}>
                {icon} {count}
              </span>
            );
          })}
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full rounded-xl border border-border/50 overflow-hidden bg-muted/20 cursor-grab active:cursor-grabbing"
        style={{ height: "500px" }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: "0 0",
            transition: dragging ? "none" : "transform 0.2s ease",
          }}
          className="relative inline-block"
        >
          {imgSrc && (
            <img
              src={imgSrc}
              alt={tr("diagram.altImage")}
              className="max-w-none"
              style={{ width: "800px" }}
              draggable={false}
            />
          )}

          {analysis.annotations?.map((ann, i) => {
            const isInPath = highlightPath && analysis.path_to_follow?.some(
              (ref) =>
                ann.label.toLowerCase().includes(ref.toLowerCase()) ||
                ann.details?.toLowerCase().includes(ref.toLowerCase())
            );
            const pathIndex = isInPath
              ? analysis.path_to_follow!.findIndex(
                  (ref) =>
                    ann.label.toLowerCase().includes(ref.toLowerCase()) ||
                    ann.details?.toLowerCase().includes(ref.toLowerCase())
                )
              : -1;
            const isActiveInPath = highlightPath && pathIndex >= 0 && pathIndex <= activePathIndex;

            return (
              <button
                key={i}
                className={`absolute flex items-center justify-center rounded-full transition-all duration-300 ${
                  selectedAnnotation === ann
                    ? "ring-2 ring-primary ring-offset-2 scale-125"
                    : isActiveInPath
                    ? "scale-125 shadow-lg"
                    : isInPath && highlightPath
                    ? "opacity-40"
                    : "hover:scale-110"
                }`}
                style={{
                  left: `${ann.x * 100}%`,
                  top: `${ann.y * 100}%`,
                  transform: "translate(-50%, -50%)",
                  width: "28px",
                  height: "28px",
                  zIndex: isActiveInPath ? 20 : selectedAnnotation === ann ? 15 : 5,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAnnotation(selectedAnnotation === ann ? null : ann);
                }}
              >
                <span
                  className={`w-full h-full rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    typeColors[ann.type] || "bg-gray-500"
                  } ${isActiveInPath ? "animate-pulse" : ""}`}
                  style={
                    isActiveInPath
                      ? { boxShadow: `0 0 20px ${ann.type === "fuse" ? "#f59e0b" : "#3b82f6"}` }
                      : {}
                  }
                >
                  {typeIcons[ann.type] || "?"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedAnnotation && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 animate-slide-up">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{typeIcons[selectedAnnotation.type] || "⚙️"}</span>
              <div>
                <p className="font-semibold text-sm">{selectedAnnotation.label}</p>
                <Badge variant="outline" className="text-xs mt-0.5">{selectedAnnotation.type}</Badge>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectedAnnotation(null)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {selectedAnnotation.details && (
            <p className="text-sm text-muted-foreground">{selectedAnnotation.details}</p>
          )}
          {selectedAnnotation.pin && (
            <p className="text-xs mt-1 flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" />
              {tr("diagram.pin")}: <span className="font-mono font-bold">{selectedAnnotation.pin}</span>
              {selectedAnnotation.wire_color && (
                <Badge variant="secondary" className="text-xs ml-1">{selectedAnnotation.wire_color}</Badge>
              )}
            </p>
          )}
        </div>
      )}

      {analysis.fuses && analysis.fuses.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-amber-500" />
            {tr("diagram.circuitFuses")}
          </p>
          <div className="flex flex-wrap gap-2">
            {analysis.fuses.map((fuse, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-sm font-bold">{fuse.reference}</span>
                <Badge variant="outline" className="text-xs">{fuse.amperage}</Badge>
                <span className="text-xs text-muted-foreground">{fuse.location}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {analysis.summary && (
        <p className="text-sm text-muted-foreground">{analysis.summary}</p>
      )}
    </div>
  );
}
