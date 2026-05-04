"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Brain,
  FileUp,
  ClipboardCheck,
  History,
  ArrowRight,
  Zap,
  Shield,
  Search,
} from "lucide-react";

export default function HomePage() {
  const t = useTranslations("home");
  const tNav = useTranslations("nav");

  const features = [
    {
      icon: Brain,
      title: t("feature1Title"),
      desc: t("feature1Desc"),
      gradient: "from-violet-500 to-purple-500",
    },
    {
      icon: FileUp,
      title: t("feature2Title"),
      desc: t("feature2Desc"),
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: ClipboardCheck,
      title: t("feature3Title"),
      desc: t("feature3Desc"),
      gradient: "from-emerald-500 to-green-500",
    },
    {
      icon: History,
      title: t("feature4Title"),
      desc: t("feature4Desc"),
      gradient: "from-orange-500 to-amber-500",
    },
  ];

  return (
    <div className="flex flex-col">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-40 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />

        <div className="container relative mx-auto px-4 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary">
              <Zap className="h-3.5 w-3.5" />
              Google Gemini AI
            </div>

            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              {t("hero").split(" ").map((word, i, arr) =>
                i >= arr.length - 2 ? (
                  <span key={i} className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    {word}{" "}
                  </span>
                ) : (
                  <span key={i}>{word} </span>
                )
              )}
            </h1>

            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("heroDescription")}
            </p>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/diagnose">
                <Button size="lg" className="gap-2 text-base px-8">
                  {t("cta")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg" className="gap-2 text-base">
                  {tNav("pricing")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <Card
              key={i}
              className="group relative overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300"
            >
              <CardContent className="p-6">
                <div
                  className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${feature.gradient} text-white shadow-lg`}
                >
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-2 font-semibold text-lg">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-border/40 bg-muted/30">
        <div className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex items-center justify-center gap-6 mb-8">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Shield className="h-4 w-4 text-emerald-500" />
                {t("secure")}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Search className="h-4 w-4 text-blue-500" />
                {t("forumSearch")}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Zap className="h-4 w-4 text-amber-500" />
                {t("fastResults")}
              </div>
            </div>
            <Link href="/diagnose">
              <Button size="lg" variant="outline" className="gap-2">
                {t("startNow")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
