"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  SkipForward,
  Wrench,
  ExternalLink,
  ClipboardCheck,
  Loader2,
  Car,
  FileText,
  RefreshCw,
  Lightbulb,
  MessageCircle,
  Download,
  Share2,
  Printer,
  Target,
  MapPin,
  Zap,
  Image as ImageIcon,
  Upload,
  X,
  BookOpen,
  Search,
  Globe,
  MessageSquare,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import type { Diagnostic, TestResult } from "@/types/diagnostic";
import { getDiagnosticLocal, saveDiagnosticLocal } from "@/lib/local-storage";
import { ChatPanel } from "@/components/chat/chat-panel";
import { AuthGate } from "@/components/auth/auth-gate";
import { DiagramViewer } from "@/components/diagram/diagram-viewer";
import { FuseBoxViewer } from "@/components/diagram/fuse-box-viewer";

const severityMap: Record<string, string> = {
  low: "low", medium: "medium", high: "high", critical: "critical",
  baja: "low", medio: "medium", media: "medium", alta: "high", critica: "critical", critico: "critical",
  baixo: "low", moderado: "medium", alto: "high", critico_pt: "critical",
};
const difficultyMap: Record<string, string> = {
  easy: "easy", medium: "medium", hard: "hard",
  facil: "easy", fácil: "easy", media: "medium", medio: "medium", dificil: "hard", difícil: "hard",
  fácil_pt: "easy", médio: "medium", difícil_pt: "hard",
};
const normalizeSeverity = (v: string) => severityMap[(v || "").toLowerCase().trim()] || "medium";
const normalizeDifficulty = (v: string) => difficultyMap[(v || "").toLowerCase().trim()] || "medium";

const severityColors: Record<string, string> = {
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  critical: "bg-red-500/10 text-red-500 border-red-500/20",
};

const severityBg: Record<string, string> = {
  low: "bg-blue-500", medium: "bg-yellow-500", high: "bg-orange-500", critical: "bg-red-500",
};

const statusIcons = {
  pending: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
  passed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  skipped: <SkipForward className="h-4 w-4 text-muted-foreground" />,
};

const refTypeIcons: Record<string, any> = {
  fuse_box: Zap,
  relay: Zap,
  component_location: MapPin,
  wiring: ImageIcon,
  manual: BookOpen,
  other: Globe,
};

const refTypeColors: Record<string, string> = {
  fuse_box: "from-amber-500/20 to-orange-500/20 border-amber-500/30",
  relay: "from-blue-500/20 to-indigo-500/20 border-blue-500/30",
  component_location: "from-emerald-500/20 to-green-500/20 border-emerald-500/30",
  wiring: "from-purple-500/20 to-violet-500/20 border-purple-500/30",
  manual: "from-slate-500/20 to-gray-500/20 border-slate-500/30",
  other: "from-cyan-500/20 to-teal-500/20 border-cyan-500/30",
};

export default function DiagnosticResultPage() {
  const tr = useTranslations("result");
  const tChat = useTranslations("chat");
  const params = useParams();
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDtcCode, setChatDtcCode] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [analyzingDiagram, setAnalyzingDiagram] = useState(false);
  const diagramFileRef = useRef<HTMLInputElement>(null);

  const openChat = (dtcCode?: string) => {
    if (dtcCode) setChatDtcCode(dtcCode);
    else setChatDtcCode(null);
    setChatOpen(true);
  };

  useEffect(() => { fetchDiagnostic(); }, [params.id]);

  const fetchDiagnostic = async () => {
    try {
      const local = getDiagnosticLocal(params.id as string);
      if (local) { setDiagnostic(local); return; }
      const res = await fetch(`/api/history/${params.id}`);
      if (res.ok) { const data = await res.json(); setDiagnostic(data); }
    } finally { setLoading(false); }
  };

  const handleTestStatus = (testId: string, status: TestResult["status"]) => {
    setTestResults((prev) => ({ ...prev, [testId]: { id: testId, diagnostic_id: params.id as string, test_id: testId, test_name: "", status, user_notes: "", ai_recommendation: "" } }));
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      const results = Object.values(testResults).map((r) => ({ test_id: r.test_id, test_name: r.test_name, status: r.status, user_notes: r.user_notes }));
      const res = await fetch(`/api/diagnose/reanalyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ diagnostic_id: params.id, test_results: results }) });
      if (res.ok) { const data = await res.json(); setDiagnostic(data); }
    } finally { setReanalyzing(false); }
  };

  const handleDiagramUpload = async (file: File) => {
    setAnalyzingDiagram(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("dtc_codes", JSON.stringify(diagnostic?.ai_analysis?.dtc_codes?.map((c: any) => c.code) || []));
      formData.append("vehicle_info", JSON.stringify(diagnostic?.vehicle_info || {}));
      formData.append("locale", document.documentElement.lang || "es");
      const res = await fetch("/api/diagnose/diagram", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Error");
      const data = await res.json();
      if (diagnostic) {
        const base64 = await fileToBase64(file);
        const updatedAnalysis = { ...diagnostic.ai_analysis, diagram_analysis: { ...data.analysis, image_base64: base64 } };
        const updatedDiagnostic = { ...diagnostic, ai_analysis: updatedAnalysis } as Diagnostic;
        setDiagnostic(updatedDiagnostic);
        saveDiagnosticLocal(updatedDiagnostic);
      }
    } catch (err) { console.error("Diagram error:", err); } finally { setAnalyzingDiagram(false); }
  };

  const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const buildReportHtml = useCallback(() => {
    const a = diagnostic?.ai_analysis;
    const v = diagnostic?.vehicle_info;
    if (!a) return "";
    const sevColor: Record<string, string> = { low: "#3b82f6", medium: "#eab308", high: "#f97316", critical: "#ef4444" };
    const diffLabel: Record<string, string> = { easy: tr("difficulty.easy"), medium: tr("difficulty.medium"), hard: tr("difficulty.hard") };
    const codesHtml = (a.dtc_codes || []).map((c: any) => `<tr><td style="font-weight:bold;padding:6px 10px;border:1px solid #e5e7eb;">${c.code}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;">${c.description}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;"><span style="color:${sevColor[normalizeSeverity(c.severity)] || "#666"};font-weight:600;">${c.severity}</span></td></tr>`).join("");
    const causesHtml = (a.probable_causes || []).map((c: any) => `<tr><td style="padding:6px 10px;border:1px solid #e5e7eb;">${c.cause}</td><td style="padding:6px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:600;">${c.probability}%</td></tr>`).join("");
    const solutionsHtml = (a.solutions || []).map((s: any) => `<div style="margin-bottom:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;"><p style="font-weight:600;margin:0 0 4px;">${s.description}</p><p style="margin:0 0 4px;color:#666;font-size:13px;">${tr("pdf.difficulty")} ${diffLabel[normalizeDifficulty(s.difficulty)] || s.difficulty} | ${tr("pdf.estimatedCost")} ${s.estimated_cost}</p>${s.steps?.length ? `<ol style="margin:6px 0 0 18px;padding:0;">${s.steps.map((st: string) => `<li style="margin-bottom:2px;">${st}</li>`).join("")}</ol>` : ""}</div>`).join("");
    const testsHtml = (a.interactive_tests || []).map((t: any, i: number) => `<div style="margin-bottom:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;"><p style="font-weight:600;margin:0 0 4px;">${i + 1}. ${t.name}</p><p style="margin:0 0 6px;color:#666;font-size:13px;">${t.description}</p><ol style="margin:4px 0 0 18px;padding:0;">${t.steps?.map((st: string) => `<li style="margin-bottom:2px;">${st}</li>`).join("")}</ol></div>`).join("");
    return `<div style="font-family:system-ui,-apple-system,sans-serif;color:#111;padding:20px;max-width:800px;margin:0 auto;"><div style="text-align:center;margin-bottom:24px;border-bottom:2px solid #3b82f6;padding-bottom:16px;"><h1 style="margin:0;font-size:22px;color:#3b82f6;">${tr("pdf.title")}</h1><p style="margin:6px 0 0;font-size:15px;">${v?.year || ""} ${v?.make || ""} ${v?.model || ""} ${v?.engine || ""}</p></div><div style="margin-bottom:20px;"><h2 style="font-size:16px;color:#3b82f6;margin:0 0 8px;">${tr("pdf.summary")}</h2><p style="margin:0;line-height:1.6;">${a.summary || ""}</p></div><div style="margin-bottom:20px;"><h2 style="font-size:16px;color:#3b82f6;margin:0 0 8px;">${tr("pdf.dtcCodes")}</h2><table style="width:100%;border-collapse:collapse;">${codesHtml}</table></div><div style="margin-bottom:20px;"><h2 style="font-size:16px;color:#3b82f6;margin:0 0 8px;">${tr("pdf.causes")}</h2><table style="width:100%;border-collapse:collapse;">${causesHtml}</table></div><div style="margin-bottom:20px;"><h2 style="font-size:16px;color:#3b82f6;margin:0 0 8px;">${tr("pdf.solutions")}</h2>${solutionsHtml}</div>${testsHtml ? `<div style="margin-bottom:20px;"><h2 style="font-size:16px;color:#3b82f6;margin:0 0 8px;">${tr("pdf.tests")}</h2>${testsHtml}</div>` : ""}</div>`;
  }, [diagnostic, tr]);

  const generatePdf = useCallback(async (action: "download" | "share" | "print") => {
    setGeneratingPdf(true);
    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const v = diagnostic?.vehicle_info;
      const filename = `${tr("pdf.diagnosis")}${v?.make || tr("pdf.vehicle")}-${v?.model || ""}-${v?.year || ""}.pdf`.replace(/\s+/g, "-");
      const html = buildReportHtml();
      if (!html) { setGeneratingPdf(false); return; }
      if (action === "print") { const pw = window.open("", "_blank"); if (pw) { pw.document.write(`<html><head><title>${filename}</title></head><body style="margin:0;">${html}</body></html>`); pw.document.close(); pw.print(); } setGeneratingPdf(false); return; }
      const iframe = document.createElement("iframe");
      iframe.style.cssText = "position:fixed;left:-9999px;width:800px;height:600px;border:none;";
      document.body.appendChild(iframe);
      const d = iframe.contentDocument || iframe.contentWindow?.document;
      if (!d) { document.body.removeChild(iframe); setGeneratingPdf(false); return; }
      d.open(); d.write(`<!DOCTYPE html><html><head><style>body{margin:0;padding:0;}</style></head><body>${html}</body></html>`); d.close();
      const opt: any = { margin: [10, 10, 10, 10], filename, image: { type: "jpeg", quality: 0.98 }, html2canvas: { scale: 2, useCORS: true, windowWidth: 800 }, jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }, pagebreak: { mode: ["avoid-all", "css", "legacy"] } };
      const worker = html2pdf().from(d.body).set(opt);
      if (action === "share") { const blob = await worker.toPdf().output("blob"); document.body.removeChild(iframe); const file = new File([blob], filename, { type: "application/pdf" }); if (navigator.share) { await navigator.share({ files: [file], title: tr("shareTitle") }); } else { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = filename; a.click(); URL.revokeObjectURL(u); } }
      else { await worker.save(); document.body.removeChild(iframe); }
    } catch (err) { console.error("PDF error:", err); } finally { setGeneratingPdf(false); }
  }, [diagnostic, buildReportHtml, tr]);

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!diagnostic?.ai_analysis) return <div className="container mx-auto px-4 py-16 text-center"><AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><h2 className="text-xl font-semibold">{tr("notFound")}</h2><Link href="/diagnose"><Button className="mt-4">{tr("newDiagnosis")}</Button></Link></div>;

  const analysis = diagnostic.ai_analysis;
  const maxSeverity = analysis.dtc_codes.reduce((m, c) => { const s = normalizeSeverity(c.severity); const o = ["low", "medium", "high", "critical"]; return o.indexOf(s) > o.indexOf(m) ? s : m; }, "low");

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      <AuthGate>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 animate-slide-up gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr("title")}</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
            <Car className="h-4 w-4" />
            {diagnostic.vehicle_info.year} {diagnostic.vehicle_info.make} {diagnostic.vehicle_info.model}
            {diagnostic.vehicle_info.engine && ` ${diagnostic.vehicle_info.engine}`}
            <Badge variant="outline" className="ml-2 text-xs">
              {diagnostic.source === "pdf" ? <><FileText className="h-3 w-3 mr-1" /> PDF</> : <><Wrench className="h-3 w-3 mr-1" /> Manual</>}
            </Badge>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => generatePdf("download")} disabled={generatingPdf}><Download className="h-3.5 w-3.5" /> PDF</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => generatePdf("share")} disabled={generatingPdf}><Share2 className="h-3.5 w-3.5" /> {tr("whatsapp")}</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => generatePdf("print")} disabled={generatingPdf}><Printer className="h-3.5 w-3.5" /> {tr("print")}</Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-slide-up stagger-1">
        <Card className="game-card p-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${severityBg[maxSeverity]} flex items-center justify-center`}>
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{tr("stats.codes")}</p>
              <p className="text-2xl font-bold">{analysis.dtc_codes.length}</p>
            </div>
          </div>
        </Card>
        <Card className="game-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Target className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{tr("stats.causes")}</p>
              <p className="text-2xl font-bold">{analysis.probable_causes.length}</p>
            </div>
          </div>
        </Card>
        <Card className="game-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500 flex items-center justify-center">
              <ClipboardCheck className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{tr("stats.tests")}</p>
              <p className="text-2xl font-bold">{analysis.interactive_tests?.length || 0}</p>
            </div>
          </div>
        </Card>
        <Card className="game-card p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500 flex items-center justify-center">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{tr("stats.severity")}</p>
              <Badge className={`mt-0.5 ${severityColors[maxSeverity]}`}>{tr(`severity.${maxSeverity}`)}</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* DTC Codes Row */}
      <div className="mb-6 animate-slide-up stagger-2">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <h2 className="font-semibold">{tr("dtcCodes")}</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {diagnostic.modules && diagnostic.modules.length > 0 ? diagnostic.modules.map((mod, mi) => (
            <div key={mi} className="flex flex-wrap gap-2">
              {mod.codes.map((code) => {
                const dtc = analysis.dtc_codes.find((d) => d.code.toUpperCase() === code.toUpperCase());
                return (
                  <div key={code} className={`rounded-xl border p-3 relative group/dtc min-w-[140px] ${dtc ? severityColors[normalizeSeverity(dtc.severity)] : "border-muted-foreground/30 bg-muted/30"}`}>
                    <button type="button" onClick={() => openChat(code)} className="absolute top-1.5 right-1.5 opacity-0 group-hover/dtc:opacity-100 transition-opacity h-5 w-5 rounded-full bg-background/80 flex items-center justify-center hover:bg-background">
                      <MessageCircle className="h-3 w-3" />
                    </button>
                    <p className="font-mono font-bold text-sm">{code}</p>
                    <p className="text-xs mt-0.5 line-clamp-2">{dtc?.description || mod.descriptions?.[code] || tr("noDescription")}</p>
                    {dtc && <Badge variant="outline" className="mt-1.5 text-[10px]">{tr(`severity.${normalizeSeverity(dtc.severity)}`)}</Badge>}
                  </div>
                );
              })}
            </div>
          )) : analysis.dtc_codes.map((dtc) => (
            <div key={dtc.code} className={`rounded-xl border p-3 relative group/dtc min-w-[140px] ${severityColors[normalizeSeverity(dtc.severity)]}`}>
              <button type="button" onClick={() => openChat(dtc.code)} className="absolute top-1.5 right-1.5 opacity-0 group-hover/dtc:opacity-100 transition-opacity h-5 w-5 rounded-full bg-background/80 flex items-center justify-center">
                <MessageCircle className="h-3 w-3" />
              </button>
              <p className="font-mono font-bold text-sm">{dtc.code}</p>
              <p className="text-xs mt-0.5 line-clamp-2">{dtc.description}</p>
              <Badge variant="outline" className="mt-1.5 text-[10px]">{tr(`severity.${normalizeSeverity(dtc.severity)}`)}</Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="causes" className="animate-slide-up stagger-3">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="causes" className="gap-1.5 text-xs flex-1 min-w-[80px]"><Target className="h-3.5 w-3.5" />{tr("tabs.causes")}</TabsTrigger>
          <TabsTrigger value="solutions" className="gap-1.5 text-xs flex-1 min-w-[80px]"><Wrench className="h-3.5 w-3.5" />{tr("tabs.solutions")}</TabsTrigger>
          <TabsTrigger value="tests" className="gap-1.5 text-xs flex-1 min-w-[80px]"><ClipboardCheck className="h-3.5 w-3.5" />{tr("tabs.tests")}</TabsTrigger>
          <TabsTrigger value="diagram" className="gap-1.5 text-xs flex-1 min-w-[80px]"><ImageIcon className="h-3.5 w-3.5" />{tr("tabs.diagram")}</TabsTrigger>
          <TabsTrigger value="fuses" className="gap-1.5 text-xs flex-1 min-w-[80px]"><Zap className="h-3.5 w-3.5" />{tr("tabs.fuses")}</TabsTrigger>
          <TabsTrigger value="components" className="gap-1.5 text-xs flex-1 min-w-[80px]"><MapPin className="h-3.5 w-3.5" />{tr("tabs.components")}</TabsTrigger>
          <TabsTrigger value="references" className="gap-1.5 text-xs flex-1 min-w-[80px]"><BookOpen className="h-3.5 w-3.5" />{tr("tabs.references")}</TabsTrigger>
          <TabsTrigger value="forums" className="gap-1.5 text-xs flex-1 min-w-[80px]"><MessageSquare className="h-3.5 w-3.5" />{tr("tabs.forums")}</TabsTrigger>
          <TabsTrigger value="videos" className="gap-1.5 text-xs flex-1 min-w-[80px]"><svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"/></svg>{tr("tabs.videos")}</TabsTrigger>
        </TabsList>

        {/* Causes Tab */}
        <TabsContent value="causes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {analysis.probable_causes.sort((a, b) => b.probability - a.probability).map((cause, i) => (
              <Card key={i} className="game-card p-4">
                <div className="flex items-center gap-4">
                  <div className="relative h-14 w-14 flex-shrink-0">
                    <svg className="h-14 w-14 -rotate-90" viewBox="0 0 36 36">
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" className="text-muted" strokeWidth="3" />
                      <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" className="text-primary" strokeWidth="3" strokeDasharray={`${cause.probability}, 100`} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">{cause.probability}%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{cause.cause}</p>
                    {cause.sources?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {cause.sources.slice(0, 2).map((src, j) => (
                          <a key={j} href={src} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5">
                            <ExternalLink className="h-2.5 w-2.5" />{src.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Solutions Tab */}
        <TabsContent value="solutions">
          <div className="space-y-3 mt-4">
            {analysis.solutions.map((sol, i) => (
              <Card key={i} className="game-card">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={normalizeDifficulty(sol.difficulty) === "easy" ? "secondary" : normalizeDifficulty(sol.difficulty) === "hard" ? "destructive" : "outline"}>
                      {tr(`difficulty.${normalizeDifficulty(sol.difficulty)}`)}
                    </Badge>
                    <span className="font-medium text-sm">{sol.description}</span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {sol.estimated_cost && <p className="text-xs text-muted-foreground mb-2">{tr("estimatedCost")}: {sol.estimated_cost}</p>}
                  <ol className="space-y-1.5">
                    {sol.steps.map((step, j) => (
                      <li key={j} className="flex gap-2 text-sm">
                        <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">{j + 1}</span>
                        <span className="text-muted-foreground">{step}</span>
                      </li>
                    ))}
                  </ol>
                  {sol.sources?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/50">
                      {sol.sources.slice(0, 3).map((src, j) => (
                        <a key={j} href={src} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5">
                          <ExternalLink className="h-2.5 w-2.5" />{src.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tests Tab */}
        <TabsContent value="tests">
          {analysis.interactive_tests?.length > 0 ? (
            <div className="mt-4">
              {analysis.interactive_tests.length > 0 && (
                <div className="mb-4 p-3 rounded-xl glass">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium">{tr("completeTests")}</span>
                    <span className="text-xs text-muted-foreground">{Object.keys(testResults).length}/{analysis.interactive_tests.length}</span>
                  </div>
                  <div className="progress-bar-game">
                    <div className="bar" style={{ width: `${(Object.keys(testResults).length / analysis.interactive_tests.length) * 100}%` }} />
                  </div>
                  {Object.keys(testResults).length > 0 && (
                    <Button onClick={handleReanalyze} disabled={reanalyzing} variant="outline" size="sm" className="gap-1.5 mt-2 w-full">
                      {reanalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      {tr("reanalyze")}
                    </Button>
                  )}
                </div>
              )}
              <div className="space-y-3">
                {analysis.interactive_tests.map((test, i) => (
                  <Card key={test.id} className="game-card">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">{i + 1}</span>
                        <div>
                          <p className="font-medium text-sm">{test.name}</p>
                          <p className="text-xs text-muted-foreground">{test.description}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      {test.tools_needed?.length > 0 && (
                        <div className="flex flex-wrap gap-1">{test.tools_needed.map((tool, j) => <Badge key={j} variant="outline" className="text-[10px]">{tool}</Badge>)}</div>
                      )}
                      <ol className="space-y-1.5">
                        {test.steps.map((step, j) => (
                          <li key={j} className="flex gap-2 text-sm">
                            <span className="flex-shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold">{j + 1}</span>
                            <span className="text-muted-foreground">{step}</span>
                          </li>
                        ))}
                      </ol>
                      {test.test_points && test.test_points.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium flex items-center gap-1"><MapPin className="h-3 w-3 text-primary" />{tr("testPoints.title")}</p>
                          {test.test_points.map((tp, j) => (
                            <div key={j} className="rounded-lg border border-border/50 bg-muted/30 p-2.5 space-y-1 text-xs">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <Badge variant="outline" className="font-mono text-[10px]">{tp.connector} pin {tp.pin}</Badge>
                                {tp.wire_color && <Badge variant="secondary" className="text-[10px]">{tp.wire_color}</Badge>}
                              </div>
                              <p><span className="font-medium">{tr("testPoints.component")}</span> {tp.component}</p>
                              <p><span className="font-medium">{tr("testPoints.expectedValue")}</span> <span className="text-primary font-medium">{tp.expected_value}</span></p>
                              <p className="text-muted-foreground"><span className="font-medium">{tr("testPoints.condition")}</span> {tp.condition}</p>
                              {tp.fuse_to_check && (
                                <div className="flex items-center gap-1 p-1 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                  <Zap className="h-3 w-3" />
                                  <span>{tr("testPoints.checkFuse")} <strong>{tp.fuse_to_check.reference}</strong> ({tp.fuse_to_check.amperage}) {tr("testPoints.in")} {tp.fuse_to_check.location}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <Alert><AlertDescription className="text-xs"><strong>{tr("expectedResult")}:</strong> {test.expected_result}</AlertDescription></Alert>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded bg-emerald-500/10 text-emerald-600"><CheckCircle2 className="inline h-3 w-3 mr-1" />{tr("passImplication")} {test.pass_implication}</div>
                        <div className="p-2 rounded bg-red-500/10 text-red-600"><XCircle className="inline h-3 w-3 mr-1" />{tr("failImplication")} {test.fail_implication}</div>
                      </div>
                      <Separator />
                      <div className="flex gap-2 items-center">
                        <span className="text-xs font-medium">{tr("resultLabel")}</span>
                        {(["passed", "failed", "skipped"] as const).map((status) => (
                          <Button key={status} type="button" size="sm" variant={testResults[test.id]?.status === status ? "default" : "outline"} onClick={() => handleTestStatus(test.id, status)} className={`gap-1 text-xs h-7 ${testResults[test.id]?.status === status ? status === "passed" ? "bg-emerald-500 hover:bg-emerald-600" : status === "failed" ? "bg-red-500 hover:bg-red-600" : "" : ""}`}>
                            {statusIcons[status]}{tr(`testStatus.${status}`)}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground mt-4">{tr("noResults")}</p>}
        </TabsContent>

        {/* Diagram Tab */}
        <TabsContent value="diagram">
          <Card className="game-card mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Zap className="h-4 w-4 text-amber-500" />{tr("diagram.title")}</CardTitle>
              <CardDescription>{tr("diagram.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent>
              {analysis.diagram_analysis ? (
                <DiagramViewer analysis={analysis.diagram_analysis} imageBase64={analysis.diagram_analysis.image_base64} imageUrl={analysis.diagram_image_url} />
              ) : analyzingDiagram ? (
                <div className="flex items-center justify-center gap-3 py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="text-sm text-muted-foreground">{tr("diagram.analyzing")}</span></div>
              ) : (
                <>
                  <input ref={diagramFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleDiagramUpload(f); e.target.value = ""; }} />
                  <label className="flex items-center gap-4 rounded-xl p-4 bg-muted/30 border-2 border-dashed border-muted-foreground/25 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0"><ImageIcon className="h-6 w-6 text-primary" /></div>
                    <div><p className="text-sm font-medium">{tr("diagram.upload")}</p><p className="text-xs text-muted-foreground">{tr("diagram.uploadHint")}</p></div>
                  </label>
                  <Button variant="outline" size="sm" className="gap-1.5 mt-2" onClick={() => diagramFileRef.current?.click()}><Upload className="h-3.5 w-3.5" />{tr("diagram.selectFile")}</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fuses Tab */}
        <TabsContent value="fuses">
          <div className="mt-4 space-y-4">
            {(analysis.fuse_boxes && analysis.fuse_boxes.length > 0) ? analysis.fuse_boxes.map((box, bi) => (
              <Card key={bi} className="game-card">
                <CardContent className="pt-4">
                  <FuseBoxViewer box={box} />
                </CardContent>
              </Card>
            )) : <p className="text-sm text-muted-foreground text-center py-8">{tr("fuses.noData")}</p>}

            {analysis.relays && analysis.relays.length > 0 && (
              <Card className="game-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-blue-500" />{tr("fuses.relays")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {analysis.relays.map((relay, ri) => (
                      <div key={ri} className="rounded-lg border border-border/50 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="font-mono text-[10px]">{relay.reference}</Badge>
                          {relay.box_name && <span className="text-[10px] text-muted-foreground">{relay.box_name}</span>}
                        </div>
                        <p className="text-xs">{relay.function}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{tr("fuses.location")}: {relay.location}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Components Tab */}
        <TabsContent value="components">
          <div className="mt-4">
            {(analysis.component_locations && analysis.component_locations.length > 0) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {analysis.component_locations.map((comp, ci) => (
                  <Card key={ci} className="game-card p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-4 w-4 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{comp.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{comp.location}</p>
                        {comp.description && <p className="text-xs text-muted-foreground mt-1">{comp.description}</p>}
                        {comp.connector && <Badge variant="outline" className="font-mono text-[10px] mt-1.5">{tr("components.connector")}: {comp.connector}</Badge>}
                        {comp.image_url && (
                          <div className="mt-2 rounded-lg overflow-hidden border">
                            <img src={`/api/proxy/image?url=${encodeURIComponent(comp.image_url)}`} alt={comp.name} className="w-full max-h-40 object-contain bg-muted" />
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground text-center py-8">{tr("components.noData")}</p>}
          </div>
        </TabsContent>

        {/* Vehicle References Tab */}
        <TabsContent value="references">
          <div className="mt-4">
            <p className="text-sm text-muted-foreground mb-4">{tr("references.subtitle")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(analysis.vehicle_references || []).map((ref, i) => {
                const Icon = refTypeIcons[ref.type] || Globe;
                const colorClass = refTypeColors[ref.type] || refTypeColors.other;
                return (
                  <a key={i} href={ref.url} target="_blank" rel="noopener noreferrer" className={`group block rounded-xl border bg-gradient-to-br p-4 hover:shadow-md transition-all ${colorClass}`}>
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-background/50 flex items-center justify-center flex-shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{ref.title}</p>
                        {ref.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{ref.description}</p>}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px]">{tr(`references.${ref.type}`)}</Badge>
                          <span className="text-[10px] text-muted-foreground">{ref.source}</span>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
              {(!analysis.vehicle_references || analysis.vehicle_references.length === 0) && (
                <p className="text-sm text-muted-foreground col-span-full text-center py-8">{tr("notFound")}</p>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Forums Tab */}
        <TabsContent value="forums">
          <div className="space-y-3 mt-4">
            {(analysis.forum_insights || []).map((insight, i) => (
              <Card key={i} className="game-card p-4">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary">{insight.forum}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{insight.summary}</p>
                    {insight.url && <a href={insight.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5 mt-1"><ExternalLink className="h-2.5 w-2.5" />{insight.url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}</a>}
                  </div>
                </div>
              </Card>
            ))}
            {(!analysis.forum_insights || analysis.forum_insights.length === 0) && <p className="text-sm text-muted-foreground text-center py-8">{tr("notFound")}</p>}
          </div>
        </TabsContent>

        {/* Videos Tab */}
        <TabsContent value="videos">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
            {(analysis.video_resources || []).map((video, i) => {
              const videoId = video.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1];
              const thumbKey = `${i}-${videoId}`;
              const thumbFailed = failedThumbs.has(thumbKey);
              const searchQuery = encodeURIComponent(`${video.title} ${analysis.dtc_codes?.[0]?.code || ""} ${video.channel || ""}`);
              const searchUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
              const href = thumbFailed || !videoId ? searchUrl : video.url;
              return (
                <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="group block rounded-xl border border-border/50 overflow-hidden hover:border-primary/30 transition-all">
                  <div className="relative aspect-video bg-muted flex items-center justify-center">
                    {videoId && !thumbFailed ? <img src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt={video.title} className="w-full h-full object-cover" onError={() => setFailedThumbs((p) => new Set(p).add(thumbKey))} /> : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground"><Search className="h-6 w-6" /><span className="text-xs">{tr("searchYoutube")}</span></div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors pointer-events-none">
                      <div className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center"><svg className="h-4 w-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg></div>
                    </div>
                  </div>
                  <div className="p-3"><p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{video.title}</p><p className="text-xs text-muted-foreground mt-0.5">{video.channel}</p></div>
                </a>
              );
            })}
            {(!analysis.video_resources || analysis.video_resources.length === 0) && <p className="text-sm text-muted-foreground text-center py-8 col-span-2">{tr("notFound")}</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* Summary Card */}
      <Card className="game-card mt-6 animate-slide-up stagger-4">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm mb-1">{tr("summary")}</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
              {analysis.vehicle_context?.affected_systems?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">{analysis.vehicle_context.affected_systems.map((sys) => <Badge key={sys} variant="secondary" className="text-[10px]">{sys}</Badge>)}</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      </AuthGate>

      <button type="button" onClick={() => openChat()} className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all hover:scale-105 flex items-center justify-center z-30" title={tChat("chatWithAi")}>
        <MessageCircle className="h-6 w-6" />
      </button>

      <ChatPanel
        diagnosticId={diagnostic?.id || ""}
        vehicleInfo={diagnostic?.vehicle_info}
        analysis={analysis}
        dtcCode={chatDtcCode}
        open={chatOpen}
        onClose={() => { setChatOpen(false); setChatDtcCode(null); }}
        onAnalysisUpdate={(updated) => { if (diagnostic) { const ud = { ...diagnostic, ai_analysis: updated } as Diagnostic; setDiagnostic(ud); saveDiagnosticLocal(ud); } }}
      />
    </div>
  );
}
