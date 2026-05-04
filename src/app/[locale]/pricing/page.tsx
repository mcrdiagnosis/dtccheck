"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Crown, Loader2 } from "lucide-react";
import { Link } from "@/i18n/routing";

const planKeys = ["free", "pro", "premium"] as const;
const featureKeys = ["diagnostics", "manualDtc", "pdfUpload", "forumSearch", "interactiveTests", "history", "exportReport"] as const;

const planConfig = {
  free: { price: "$0", popular: false, included: [true, true, false, false, false, true, false] },
  pro: { price: "$9.99", popular: true, included: [true, true, true, true, true, true, true] },
  premium: { price: "$19.99", popular: false, included: [true, true, true, true, true, true, true] },
};

export default function PricingPage() {
  const t = useTranslations("pricing");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSubscribe = async (planKey: string) => {
    setLoadingPlan(planKey);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planKey }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="container mx-auto px-4 py-16 max-w-5xl">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <p className="text-muted-foreground mt-2">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {planKeys.map((key) => {
          const config = planConfig[key];
          return (
            <Card
              key={key}
              className={`relative ${
                config.popular ? "border-primary shadow-lg shadow-primary/10" : ""
              }`}
            >
              {config.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1">
                    <Zap className="h-3 w-3" />
                    {t("popular")}
                  </Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl">
                  {key === "pro" && <Zap className="inline h-5 w-5 mr-1 text-primary" />}
                  {key === "premium" && <Crown className="inline h-5 w-5 mr-1 text-amber-500" />}
                  {t(key as any)}
                </CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold">{config.price}</span>
                  {config.price !== "$0" && (
                    <span className="text-muted-foreground">{t("month")}</span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {featureKeys.map((fk, i) => (
                    <div key={fk} className="flex items-center gap-2 text-sm">
                      {config.included[i] ? (
                        <Check className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <div className="h-4 w-4 flex-shrink-0 rounded-full border border-muted-foreground/30" />
                      )}
                      <span className={config.included[i] ? "" : "text-muted-foreground"}>
                        {t(`${key}Features.${fk}` as any)}
                      </span>
                    </div>
                  ))}
                </div>
                {key === "free" ? (
                  <Link href="/diagnose">
                    <Button className="w-full" variant="outline">
                      {t("currentPlan")}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    className="w-full"
                    variant={config.popular ? "default" : "outline"}
                    onClick={() => handleSubscribe(key)}
                    disabled={loadingPlan === key}
                  >
                    {loadingPlan === key && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    {t("subscribe")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
