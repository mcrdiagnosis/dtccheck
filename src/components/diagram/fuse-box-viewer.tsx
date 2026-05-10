"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Zap, Search, X } from "lucide-react";
import type { FuseBox, FuseEntry } from "@/types/diagnostic";

interface FuseBoxViewerProps {
  box: FuseBox;
}

const ampColors: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  "5A": { bg: "bg-orange-400", border: "border-orange-500", text: "text-white", glow: "shadow-orange-400/50" },
  "7.5A": { bg: "bg-amber-600", border: "border-amber-700", text: "text-white", glow: "shadow-amber-600/50" },
  "10A": { bg: "bg-red-500", border: "border-red-600", text: "text-white", glow: "shadow-red-500/50" },
  "15A": { bg: "bg-blue-500", border: "border-blue-600", text: "text-white", glow: "shadow-blue-500/50" },
  "20A": { bg: "bg-yellow-400", border: "border-yellow-500", text: "text-black", glow: "shadow-yellow-400/50" },
  "25A": { bg: "bg-white", border: "border-gray-300", text: "text-black", glow: "shadow-gray-300/50" },
  "30A": { bg: "bg-green-500", border: "border-green-600", text: "text-white", glow: "shadow-green-500/50" },
  "40A": { bg: "bg-pink-400", border: "border-pink-500", text: "text-white", glow: "shadow-pink-400/50" },
};

function getAmpColor(amp: string) {
  const key = amp.replace(/\s/g, "").toUpperCase();
  for (const [k, v] of Object.entries(ampColors)) {
    if (key.startsWith(k) || key === k) return v;
  }
  return { bg: "bg-gray-400", border: "border-gray-500", text: "text-white", glow: "shadow-gray-400/50" };
}

export function FuseBoxViewer({ box }: FuseBoxViewerProps) {
  const t = useTranslations("result.fuses");
  const [selected, setSelected] = useState<FuseEntry | null>(null);
  const [search, setSearch] = useState("");

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

  const cols = box.fuses.length > 20 ? 8 : box.fuses.length > 10 ? 6 : box.fuses.length > 6 ? 4 : 3;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Zap className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">{box.name}</h3>
            <p className="text-xs text-muted-foreground">{box.location}{box.reference ? ` (${box.reference})` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search")}
              className="pl-8 h-8 text-xs w-48"
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
        </div>
      </div>

      {box.image_url && (
        <div className="rounded-lg overflow-hidden border">
          <img src={`/api/proxy/image?url=${encodeURIComponent(box.image_url)}`} alt={box.name} className="w-full max-h-48 object-contain bg-muted" />
        </div>
      )}

      <div
        className="grid gap-2 p-4 rounded-xl bg-muted/30 border border-border/50"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
      >
        {box.fuses.map((fuse) => {
          const color = getAmpColor(fuse.amperage);
          const isFiltered = highlighted.has(fuse.number);
          const isSelected = selected?.number === fuse.number;
          const isDimmed = search.trim() && !isFiltered;

          return (
            <button
              key={fuse.number}
              onClick={() => setSelected(isSelected ? null : fuse)}
              className={`
                relative flex flex-col items-center justify-center rounded-lg p-2 border-2 transition-all
                ${color.bg} ${color.border} ${color.text}
                ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 z-10 shadow-lg " + color.glow : ""}
                ${isFiltered && !isSelected ? "scale-105 shadow-md " + color.glow + " animate-pulse" : ""}
                ${isDimmed ? "opacity-30 scale-95" : ""}
                hover:scale-105 hover:shadow-md cursor-pointer
              `}
              title={`${fuse.number} - ${fuse.circuit} (${fuse.amperage})`}
            >
              <span className="font-mono font-bold text-[10px] leading-none">{fuse.number}</span>
              <span className="text-[8px] leading-none mt-0.5 opacity-80">{fuse.amperage}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5 items-center">
        {Object.entries(ampColors).map(([amp, color]) => {
          const count = box.fuses.filter((f) => getAmpColor(f.amperage).bg === color.bg).length;
          if (count === 0) return null;
          return (
            <div key={amp} className="flex items-center gap-1">
              <div className={`h-3 w-3 rounded-sm ${color.bg} border ${color.border}`} />
              <span className="text-[10px] text-muted-foreground">{amp}</span>
            </div>
          );
        })}
      </div>

      {selected && (
        <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 animate-slide-up">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getAmpColor(selected.amperage).bg} ${getAmpColor(selected.amperage).text}`}>
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold">{selected.number}</span>
                  <Badge variant="outline" className="font-mono text-xs">{selected.amperage}</Badge>
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

      {search.trim() && filtered.length > 0 && !selected && (
        <div className="space-y-1.5">
          {filtered.map((fuse) => (
            <button
              key={fuse.number}
              onClick={() => setSelected(fuse)}
              className="w-full text-left p-2.5 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all flex items-center gap-3"
            >
              <div className={`h-7 w-7 rounded flex items-center justify-center flex-shrink-0 ${getAmpColor(fuse.amperage).bg} ${getAmpColor(fuse.amperage).text}`}>
                <span className="font-mono text-[9px] font-bold">{fuse.number}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{fuse.circuit}</p>
                <p className="text-[10px] text-muted-foreground">{fuse.amperage} {fuse.protected_component ? `• ${fuse.protected_component}` : ""}</p>
              </div>
              <Badge variant="outline" className="font-mono text-[10px]">{fuse.amperage}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
