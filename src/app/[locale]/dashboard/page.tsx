"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Wrench,
  FileText,
  Clock,
  Car,
  Trash2,
  Eye,
  Loader2,
  Plus,
} from "lucide-react";
import type { Diagnostic } from "@/types/diagnostic";
import { getAllLocal, deleteDiagnosticLocal } from "@/lib/local-storage";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  analyzing: "bg-blue-500/10 text-blue-500",
  completed: "bg-emerald-500/10 text-emerald-500",
  tests_in_progress: "bg-orange-500/10 text-orange-500",
};

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tResult = useTranslations("result");
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const fetchDiagnostics = async () => {
    try {
      const local = getAllLocal();
      if (local.length > 0) {
        setDiagnostics(local);
        return;
      }

      const res = await fetch("/api/history");
      if (res.ok) {
        const data = await res.json();
        setDiagnostics(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteDiagnostic = async (id: string) => {
    deleteDiagnosticLocal(id);
    setDiagnostics((prev) => prev.filter((d) => d.id !== id));
    await fetch(`/api/history/${id}`, { method: "DELETE" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>
        <Link href="/diagnose">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
        </Link>
      </div>

      {diagnostics.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent>
            <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">{t("noDiagnostics")}</h2>
            <Link href="/diagnose">
              <Button className="mt-4">{t("startOne")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {diagnostics.map((diag) => (
            <Card key={diag.id} className="hover:border-primary/30 transition-colors">
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    {diag.source === "pdf" ? (
                      <FileText className="h-6 w-6 text-primary" />
                    ) : (
                      <Wrench className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      <Car className="inline h-4 w-4 mr-1" />
                      {diag.vehicle_info?.year} {diag.vehicle_info?.make}{" "}
                      {diag.vehicle_info?.model}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex gap-1">
                        {diag.dtc_codes?.slice(0, 3).map((code) => (
                          <Badge key={code.code} variant="outline" className="font-mono text-xs">
                            {code.code}
                          </Badge>
                        ))}
                        {diag.dtc_codes?.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{diag.dtc_codes.length - 3}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-0.5" />
                        {new Date(diag.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={statusColors[diag.status] || ""}>
                    {t(`status.${diag.status}`)}
                  </Badge>
                  <Link href={`/diagnose/${diag.id}`}>
                    <Button variant="ghost" size="icon">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                  <AlertDialog>
                    <AlertDialogTrigger
                      className="inline-flex items-center justify-center rounded-md text-destructive hover:bg-accent h-9 w-9"
                    >
                      <Trash2 className="h-4 w-4" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteDiagnostic(diag.id)}>
                          Eliminar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
