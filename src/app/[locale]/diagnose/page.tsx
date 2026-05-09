"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveDiagnosticLocal } from "@/lib/local-storage";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileUp,
  FileText,
  Upload,
  Loader2,
  Car,
  AlertCircle,
  CheckCircle2,
  X,
  Cpu,
  Zap,
  ArrowRight,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Controller } from "react-hook-form";

const MODULE_OPTIONS = [
  { value: "engine", labelKey: "engine", icon: "🔧", color: "from-red-500/20 to-orange-500/20" },
  { value: "transmission", labelKey: "transmission", icon: "⚙️", color: "from-blue-500/20 to-indigo-500/20" },
  { value: "abs", labelKey: "abs", icon: "🛞", color: "from-yellow-500/20 to-amber-500/20" },
  { value: "airbag", labelKey: "airbag", icon: "🛡️", color: "from-purple-500/20 to-pink-500/20" },
  { value: "body", labelKey: "body", icon: "🚗", color: "from-green-500/20 to-teal-500/20" },
  { value: "chassis", labelKey: "chassis", icon: "🔩", color: "from-slate-500/20 to-gray-500/20" },
  { value: "network", labelKey: "communication", icon: "📡", color: "from-cyan-500/20 to-blue-500/20" },
  { value: "emissions", labelKey: "emissions", icon: "💨", color: "from-emerald-500/20 to-green-500/20" },
  { value: "fuel", labelKey: "fuel", icon: "⛽", color: "from-amber-500/20 to-yellow-500/20" },
  { value: "ignition", labelKey: "ignition", icon: "⚡", color: "from-violet-500/20 to-purple-500/20" },
  { value: "other", labelKey: "other", icon: "❓", color: "from-gray-400/20 to-gray-500/20" },
];

const diagnoseSchema = z.object({
  dtc_codes: z.string().optional(),
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.string().min(4),
  engine: z.string().optional(),
  module: z.string().optional(),
});

type DiagnoseForm = z.infer<typeof diagnoseSchema>;

export default function DiagnosePage() {
  const t = useTranslations("diagnose");
  const locale = useLocale();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("manual");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [diagramImage, setDiagramImage] = useState<File | null>(null);
  const [diagramPreview, setDiagramPreview] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const form = useForm<DiagnoseForm>({
    resolver: zodResolver(diagnoseSchema),
    defaultValues: { dtc_codes: "", make: "", model: "", year: "", engine: "", module: "" },
  });

  const watchFields = form.watch();
  const hasCodes = activeTab === "pdf" ? !!pdfFile : (watchFields.dtc_codes?.trim().length || 0) > 0;
  const hasVehicle = !!(watchFields.make && watchFields.model && watchFields.year);

  useEffect(() => {
    if (activeTab === "pdf") {
      form.setValue("dtc_codes", "pdf-upload");
    } else {
      form.setValue("dtc_codes", "");
    }
  }, [activeTab, form]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file?.type === "application/pdf") {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfFile(file);
      setPdfUrl(URL.createObjectURL(file));
      toast.success(t("pdfLoaded"));
    } else {
      toast.error(t("pdfRequired"));
    }
  }, [pdfUrl, t]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfFile(file);
      setPdfUrl(URL.createObjectURL(file));
      toast.success(t("pdfLoaded"));
    }
  };

  const removePdf = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfFile(null);
    setPdfUrl(null);
  };

  const onSubmit = async (data: DiagnoseForm) => {
    if (activeTab === "manual" && (!data.dtc_codes || data.dtc_codes.trim() === "")) {
      form.setError("dtc_codes", { message: t("dtcRequired") });
      return;
    }

    if (activeTab === "pdf" && !pdfFile) {
      toast.error(t("pdfRequired"));
      return;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setElapsed(0);
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      const payload: any = {
        dtc_codes: (data.dtc_codes || "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
        locale,
        vehicle_info: {
          make: data.make,
          model: data.model,
          year: parseInt(data.year),
          engine: data.engine || undefined,
          module: data.module || undefined,
        },
      };

      if (activeTab === "pdf" && pdfFile) {
        const formData = new FormData();
        formData.append("pdf", pdfFile);
        formData.append("vehicle_info", JSON.stringify(payload.vehicle_info));
        formData.append("locale", locale);

        const res = await fetch("/api/diagnose/pdf", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || t("pdfError"));
        }
        const result = await res.json();
        saveDiagnosticLocal(result);
        clearInterval(progressInterval);
        setProgress(100);
        router.push(`/diagnose/${result.id}`);
      } else {
        let res: Response;
        if (diagramImage) {
          const fd = new FormData();
          fd.append("dtc_codes", JSON.stringify(payload.dtc_codes));
          fd.append("vehicle_info", JSON.stringify(payload.vehicle_info));
          fd.append("locale", locale);
          fd.append("diagram", diagramImage);
          res = await fetch("/api/diagnose/dtc", { method: "POST", body: fd });
        } else {
          res = await fetch("/api/diagnose/dtc", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }

        if (!res.ok) throw new Error(t("analysisError"));
        const result = await res.json();
        saveDiagnosticLocal(result);
        clearInterval(progressInterval);
        setProgress(100);
        router.push(`/diagnose/${result.id}`);
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      toast.error(error.message || t("analysisErrorFallback"));
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8 text-center animate-slide-up">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex items-center justify-center gap-3 mb-8 animate-slide-up stagger-1">
        {[
          { label: t("dtcTitle"), done: hasCodes, active: hasCodes && !hasVehicle },
          { label: t("vehicleInfo"), done: hasVehicle, active: hasCodes && hasVehicle },
          { label: t("analyze"), done: false, active: false },
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`step-indicator ${step.done ? "step-done" : step.active ? "step-active" : "step-idle"}`}>
              {step.done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${step.done ? "text-emerald-500" : step.active ? "text-primary" : "text-muted-foreground"}`}>
              {step.label}
            </span>
            {i < 2 && <div className={`w-8 h-0.5 rounded ${step.done ? "bg-emerald-500" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6 animate-scale-in">
            <TabsTrigger value="manual" className="gap-2">
              <Car className="h-4 w-4" />
              {t("tabManual")}
            </TabsTrigger>
            <TabsTrigger value="pdf" className="gap-2">
              <FileUp className="h-4 w-4" />
              {t("tabPdf")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="animate-slide-up">
            <Card className="game-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-primary" />
                  {t("dtcTitle")}
                </CardTitle>
                <CardDescription>{t("dtcHelp")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  placeholder={t("dtcPlaceholder")}
                  {...form.register("dtc_codes")}
                  className="font-mono text-lg"
                />
                {form.formState.errors.dtc_codes && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.dtc_codes.message}
                  </p>
                )}

                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-primary" />
                    {t("moduleLabel")}
                  </Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {MODULE_OPTIONS.map((mod) => (
                      <button
                        key={mod.value}
                        type="button"
                        onClick={() => {
                          setSelectedModule(mod.value === selectedModule ? null : mod.value);
                          form.setValue("module", mod.value === selectedModule ? "" : mod.value);
                        }}
                        className={`module-tile rounded-xl p-3 text-center bg-gradient-to-br ${mod.color}`}
                      >
                        <div className="text-2xl mb-1">{mod.icon}</div>
                        <div className="text-[10px] font-medium leading-tight">{t(`modules.${mod.labelKey}` as any)}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{t("moduleHelp")}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pdf" className="animate-slide-up">
            <Card className="game-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileUp className="h-5 w-5 text-primary" />
                  {t("tabPdf")}
                </CardTitle>
                <CardDescription>{t("pdfSupported")}</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition-all duration-300 ${
                    dragActive
                      ? "border-primary bg-primary/5 scale-[1.02]"
                      : pdfFile
                      ? "border-emerald-500 bg-emerald-500/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                >
                  {pdfFile ? (
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                      <div>
                        <p className="font-medium">{pdfFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(pdfFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={removePdf}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                      <p className="text-center text-muted-foreground">
                        {t("pdfDropzone")}
                      </p>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Card className="mt-6 game-card animate-slide-up stagger-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              {t("diagramTitle")}
            </CardTitle>
            <CardDescription>{t("diagramSubtitle")}</CardDescription>
          </CardHeader>
          <CardContent>
            {diagramImage ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <img src={diagramPreview!} alt="Diagram" className="h-16 w-16 object-cover rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t("diagramAttached")}</p>
                    <p className="text-xs text-muted-foreground truncate">{diagramImage.name}</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setDiagramImage(null); setDiagramPreview(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <label className="flex items-center gap-4 rounded-xl p-4 bg-muted/30 border-2 border-dashed border-muted-foreground/25 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">{t("diagramUpload")}</p>
                  <p className="text-xs text-muted-foreground">{t("diagramUploadHint")}</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setDiagramImage(file);
                      setDiagramPreview(URL.createObjectURL(file));
                    }
                  }}
                />
              </label>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6 game-card animate-slide-up stagger-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              {t("vehicleInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("make")}</Label>
                <Input placeholder="Toyota" {...form.register("make")} />
                {form.formState.errors.make && (
                  <p className="text-sm text-destructive">{form.formState.errors.make.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("model")}</Label>
                <Input placeholder="Corolla" {...form.register("model")} />
                {form.formState.errors.model && (
                  <p className="text-sm text-destructive">{form.formState.errors.model.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("year")}</Label>
                <Input placeholder="2020" {...form.register("year")} />
                {form.formState.errors.year && (
                  <p className="text-sm text-destructive">{form.formState.errors.year.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("engine")}</Label>
                <Input placeholder="2.0L" {...form.register("engine")} />
              </div>
            </div>
            {pdfUrl && (
              <div className="mt-4 rounded-xl border overflow-hidden glass">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium truncate flex-1">{pdfFile?.name}</span>
                  <span className="text-xs text-muted-foreground">{pdfFile ? `${(pdfFile.size / 1024).toFixed(1)} KB` : ""}</span>
                </div>
                <iframe src={pdfUrl} className="w-full h-64 md:h-96" title={t("pdfPreview")} />
              </div>
            )}
          </CardContent>
        </Card>

        {isAnalyzing && (
          <Card className="mt-6 game-card animate-scale-in">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="font-medium">{t("analyzing")}</span>
                <span className="text-muted-foreground font-mono">{elapsed}s</span>
              </div>
              <div className="progress-bar-game">
                <div className="bar" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                {t("analyzingProgress")}
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex justify-end animate-slide-up stagger-3">
          <Button
            type="submit"
            size="lg"
            disabled={isAnalyzing}
            className="game-btn gap-2 px-8"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("analyzing")}
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                {t("analyze")}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
