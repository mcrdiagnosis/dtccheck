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

const severityColors = {
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

  useEffect(() => {
    fetchDiagnostic();
  }, [params.id]);

  const fetchDiagnostic = async () => {
    try {
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
                  className={`rounded-lg border p-3 ${severityColors[dtc.severity]}`}
                >
                  <p className="font-mono font-bold">{dtc.code}</p>
                  <p className="text-sm mt-1">{dtc.description}</p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    {t(`severity.${dtc.severity}`)}
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
                      <div className="flex gap-1 mt-1">
                        {cause.sources.slice(0, 2).map((src, j) => (
                          <a
                            key={j}
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="inline h-3 w-3 mr-0.5" />
                            fuente
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
                          sol.difficulty === "easy"
                            ? "secondary"
                            : sol.difficulty === "medium"
                            ? "outline"
                            : "destructive"
                        }
                      >
                        {t(`difficulty.${sol.difficulty}`)}
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
                  key={i}
                  className="p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {insight.forum}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {insight.summary}
                      </p>
                    </div>
                    {insight.url && (
                      <a
                        href={insight.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button variant="ghost" size="icon" className="flex-shrink-0">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
