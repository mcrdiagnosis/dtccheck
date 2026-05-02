"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown } from "lucide-react";
import Link from "next/link";

const plans = [
  {
    key: "free",
    price: "$0",
    features: [
      { text: "3 diagnósticos/mes", included: true },
      { text: "Ingreso manual de DTC", included: true },
      { text: "Subir PDF", included: false },
      { text: "Búsqueda en foros", included: false },
      { text: "Pruebas interactivas", included: false },
      { text: "Historial 7 días", included: true },
      { text: "Exportar reporte", included: false },
    ],
    cta: "Plan actual",
    popular: false,
  },
  {
    key: "pro",
    price: "$9.99",
    features: [
      { text: "30 diagnósticos/mes", included: true },
      { text: "Ingreso manual de DTC", included: true },
      { text: "Subir PDF", included: true },
      { text: "Búsqueda en foros", included: true },
      { text: "5 pruebas/diagnóstico", included: true },
      { text: "Historial 1 año", included: true },
      { text: "Exportar reporte PDF", included: true },
    ],
    cta: "Suscribirse",
    popular: true,
  },
  {
    key: "premium",
    price: "$19.99",
    features: [
      { text: "Diagnósticos ilimitados", included: true },
      { text: "Ingreso manual de DTC", included: true },
      { text: "Subir PDF", included: true },
      { text: "Búsqueda en foros", included: true },
      { text: "Pruebas ilimitadas", included: true },
      { text: "Historial ilimitado", included: true },
      { text: "Exportar + compartir", included: true },
    ],
    cta: "Suscribirse",
    popular: false,
  },
];

export default function PricingPage() {
  const t = useTranslations("pricing");

  return (
    <div className="container mx-auto px-4 py-16 max-w-5xl">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card
            key={plan.key}
            className={`relative ${
              plan.popular ? "border-primary shadow-lg shadow-primary/10" : ""
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="gap-1">
                  <Zap className="h-3 w-3" />
                  Popular
                </Badge>
              </div>
            )}
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">
                {plan.key === "pro" && <Zap className="inline h-5 w-5 mr-1 text-primary" />}
                {plan.key === "premium" && <Crown className="inline h-5 w-5 mr-1 text-amber-500" />}
                {t(plan.key as any)}
              </CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.price !== "$0" && (
                  <span className="text-muted-foreground">{t("month")}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                {plan.features.map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {feature.included ? (
                      <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <div className="h-4 w-4 flex-shrink-0 rounded-full border border-muted-foreground/30" />
                    )}
                    <span className={feature.included ? "" : "text-muted-foreground"}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>
              <Link href={plan.key === "free" ? "/diagnose" : `/api/stripe/checkout?plan=${plan.key}`}>
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
