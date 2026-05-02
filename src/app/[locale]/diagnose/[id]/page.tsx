"use client";

import { useEffect, useState } from "react";
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
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
  MessageSquare,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import type { Diagnostic, TestResult } from "@/types/diagnostic";
import { getDiagnosticLocal } from "@/lib/local-storage";

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

const statusIcons = {
  pending: <AlertTriangle className="h-4 w-4 text-muted-foreground" />,
  passed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  failed: <XCircle className="h-4 w-4 text-red-500" />,
  skipped: <SkipForward className="h-4 w-4 text-muted-foreground" />,
};

export default function DiagnosticResultPage() {
  const t = useTranslations("result");
  const params = useParams();
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDiagnostic();
  }, [params.id]);

  const fetchDiagnostic = async () => {
    try {
      const local = getDiagnosticLocal(params.id as string);
      if (local) {
        setDiagnostic(local);
        return;
      }

      const res = await fetch(`/api/history/${params.id}`);
      if (res.ok) {
        const data = await res.json();
        setDiagnostic(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestStatus = (testId: string, status: TestResult["status"]) => {
    setTestResults((prev) => ({
      ...prev,
      [testId]: {
        id: testId,
        diagnostic_id: params.id as string,
        test_id: testId,
        test_name: "",
        status,
        user_notes: "",
        ai_recommendation: "",
      },
    }));
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      const results = Object.values(testResults).map((r) => ({
        test_id: r.test_id,
        test_name: r.test_name,
        status: r.status,
        user_notes: r.user_notes,
      }));

      const res = await fetch(`/api/diagnose/reanalyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnostic_id: params.id, test_results: results }),
      });

      if (res.ok) {
        const data = await res.json();
        setDiagnostic(data);
      }
    } finally {
      setReanalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!diagnostic?.ai_analysis) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold">Diagnóstico no encontrado</h2>
        <Link href="/diagnose">
          <Button className="mt-4">Nuevo diagnóstico</Button>
        </Link>
      </div>
    );
  }

  const analysis = diagnostic.ai_analysis;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">
            <Car className="inline h-4 w-4 mr-1" />
            {diagnostic.vehicle_info.year} {diagnostic.vehicle_info.make}{" "}
            {diagnostic.vehicle_info.model}
            {diagnostic.vehicle_info.engine && ` ${diagnostic.vehicle_info.engine}`}
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          {diagnostic.source === "pdf" ? (
            <><FileText className="h-3 w-3 mr-1" /> PDF</>
          ) : (
            <><Wrench className="h-3 w-3 mr-1" /> Manual</>
          )}
        </Badge>
      </div>

      <div className="grid gap-6">
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              {t("summary")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{analysis.summary}</p>
            {analysis.vehicle_context?.affected_systems?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {analysis.vehicle_context.affected_systems.map((sys) => (
                  <Badge key={sys} variant="secondary">
                    {sys}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              {t("dtcCodes")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {analysis.dtc_codes.map((dtc) => (
                <div
                  key={dtc.code}
                  className={`rounded-lg border p-3 ${severityColors[normalizeSeverity(dtc.severity)]}`}
                >
                  <p className="font-mono font-bold">{dtc.code}</p>
                  <p className="text-sm mt-1">{dtc.description}</p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {t(`severity.${normalizeSeverity(dtc.severity)}`)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("probableCauses")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analysis.probable_causes
              .sort((a, b) => b.probability - a.probability)
              .map((cause, i) => (
                <div
                  key={i}
                  className="flex items-start gap-4 p-4 rounded-lg bg-muted/50"
                >
                  <div className="flex-shrink-0">
                    <div className="relative h-12 w-12">
                      <svg className="h-12 w-12 -rotate-90" viewBox="0 0 36 36">
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          className="text-muted"
                          strokeWidth="3"
                        />
                        <path
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          fill="none"
                          stroke="currentColor"
                          className="text-primary"
                          strokeWidth="3"
                          strokeDasharray={`${cause.probability}, 100`}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                        {cause.probability}%
                      </span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{cause.cause}</p>
                    {cause.sources?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {cause.sources.slice(0, 3).map((src, j) => (
                          <a
                            key={j}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline break-all inline-flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            {src.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").substring(0, 60)}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-emerald-500" />
              {t("solutions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion className="w-full">
              {analysis.solutions.map((sol, i) => (
                <AccordionItem key={i} value={`sol-${i}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Badge
                        variant={
                          normalizeDifficulty(sol.difficulty) === "easy"
                            ? "secondary"
                            : normalizeDifficulty(sol.difficulty) === "medium"
                            ? "outline"
                            : "destructive"
                        }
                      >
                        {t(`difficulty.${normalizeDifficulty(sol.difficulty)}`)}
                      </Badge>
                      <span>{sol.description}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {sol.estimated_cost && (
                        <p className="text-sm">
                          <strong>{t("estimatedCost")}:</strong> {sol.estimated_cost}
                        </p>
                      )}
                      <div>
                        <p className="font-medium text-sm mb-2">{t("steps")}:</p>
                        <ol className="space-y-2">
                          {sol.steps.map((step, j) => (
                            <li key={j} className="flex gap-3 text-sm">
                              <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                                {j + 1}
                              </span>
                              <span className="text-muted-foreground">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                      {sol.sources?.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          {sol.sources.slice(0, 3).map((src, j) => (
                            <a
                              key={j}
                              href={src}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline break-all inline-flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                              {src.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").substring(0, 60)}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>

        {analysis.interactive_tests?.length > 0 && (
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardCheck className="h-5 w-5 text-primary" />
                    {t("tests")}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Realiza estas pruebas para completar el diagnóstico
                  </CardDescription>
                </div>
                {Object.keys(testResults).length > 0 && (
                  <Button
                    onClick={handleReanalyze}
                    disabled={reanalyzing}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    {reanalyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    {t("reanalyze")}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Accordion className="w-full">
                {analysis.interactive_tests.map((test, i) => (
                  <AccordionItem key={test.id} value={test.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3 text-left">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
                          {i + 1}
                        </span>
                        <div>
                          <p className="font-medium">{test.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {test.description}
                          </p>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2 pl-11">
                        {test.tools_needed?.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-1">
                              {t("toolsNeeded")}:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {test.tools_needed.map((tool, j) => (
                                <Badge key={j} variant="outline" className="text-xs">
                                  {tool}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <ol className="space-y-2">
                          {test.steps.map((step, j) => (
                            <li key={j} className="flex gap-3 text-sm">
                              <span className="flex-shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold">
                                {j + 1}
                              </span>
                              <span className="text-muted-foreground">{step}</span>
                            </li>
                          ))}
                        </ol>

                        <Alert>
                          <AlertDescription>
                            <strong>{t("expectedResult")}:</strong> {test.expected_result}
                          </AlertDescription>
                        </Alert>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="p-2 rounded bg-emerald-500/10 text-emerald-600">
                            <CheckCircle2 className="inline h-3 w-3 mr-1" />
                            {t("passImplication")} {test.pass_implication}
                          </div>
                          <div className="p-2 rounded bg-red-500/10 text-red-600">
                            <XCircle className="inline h-3 w-3 mr-1" />
                            {t("failImplication")} {test.fail_implication}
                          </div>
                        </div>

                        <Separator />

                        <div className="flex gap-2">
                          <p className="text-sm font-medium self-center mr-2">
                            Resultado:
                          </p>
                          {(["passed", "failed", "skipped"] as const).map((status) => (
                            <Button
                              key={status}
                              type="button"
                              size="sm"
                              variant={
                                testResults[test.id]?.status === status
                                  ? "default"
                                  : "outline"
                              }
                              onClick={() => handleTestStatus(test.id, status)}
                              className="gap-1"
                            >
                              {statusIcons[status]}
                              {t(`testStatus.${status}`)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        )}

        {analysis.forum_insights?.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                {t("forumInsights")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.forum_insights.map((insight, i) => (
                <div
                  key={`forum-${i}`}
                  className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary">
                        {insight.forum}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {insight.summary}
                      </p>
                      {insight.url && (
                        <a
                          href={insight.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline break-all inline-flex items-center gap-1 mt-2"
                        >
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                          {insight.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {analysis.video_resources && analysis.video_resources.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                Videos de YouTube
              </CardTitle>
              <CardDescription>Videos relacionados con este diagnóstico</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {analysis.video_resources.map((video, i) => {
                  const videoId = video.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/)?.[1];
                  const thumbKey = `${i}-${videoId}`;
                  const thumbFailed = failedThumbs.has(thumbKey);
                  const searchQuery = encodeURIComponent(`${video.title} ${analysis.dtc_codes?.[0]?.code || ""} ${video.channel || ""}`);
                  const searchUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
                  const href = thumbFailed || !videoId ? searchUrl : video.url;
                  return (
                    <a
                      key={`video-${i}`}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group block rounded-lg border border-border/50 overflow-hidden hover:border-primary/30 transition-all"
                    >
                      <div className="relative aspect-video bg-muted flex items-center justify-center">
                        {videoId && !thumbFailed ? (
                          <img
                            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                            alt={video.title}
                            className="w-full h-full object-cover"
                            onError={() => {
                              setFailedThumbs((prev) => new Set(prev).add(thumbKey));
                            }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <svg className="h-8 w-8" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M21.21 3.79a.996.996 0 0 0-1.09-.21C19.44 3.89 17.56 4.5 16 4.5c-2.46 0-4.54-1.56-6-3.12-.46-.46-1.26-.32-1.53.24C7.37 4.2 6 6.84 6 9.5c0 3.59 2.41 6.59 5.68 7.61A5.465 5.465 0 0 0 11 18.5v.5H9c-.55 0-1 .45-1 1s.45 1 1 1h6c.55 0 1-.45 1-1s-.45-1-1-1h-2v-.5c0-.49-.1-.96-.27-1.39C16.16 15.87 19 12.56 19 8.5c0-1.37-.29-2.67-.81-3.86.95-.34 1.95-.8 2.71-1.29.68-.44.69-1.37.31-1.56z"/>
                            </svg>
                            <span className="text-xs">Buscar en YouTube</span>
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors pointer-events-none">
                          <div className="h-12 w-12 rounded-full bg-red-600 flex items-center justify-center">
                            <svg className="h-5 w-5 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                          {video.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {video.channel}
                        </p>
                        {video.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {video.description}
                          </p>
                        )}
                        {(thumbFailed || !videoId) && (
                          <p className="text-xs text-primary mt-1">
                            Buscar videos reales →
                          </p>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
