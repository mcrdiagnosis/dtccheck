"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  FileUp,
  ClipboardCheck,
  History,
  ArrowRight,
  Zap,
  Shield,
  Search,
  Trophy,
  Cpu,
  Wrench,
  Star,
} from "lucide-react";

export default function HomePage() {
  const t = useTranslations("home");
  const tNav = useTranslations("nav");

  const features = [
    {
      icon: Brain,
      title: t("feature1Title"),
      desc: t("feature1Desc"),
      gradient: "from-violet-500 to-purple-600",
      xp: "+50 XP",
      xpClass: "xp-badge-gold",
    },
    {
      icon: FileUp,
      title: t("feature2Title"),
      desc: t("feature2Desc"),
      gradient: "from-blue-500 to-cyan-600",
      xp: "+30 XP",
      xpClass: "xp-badge-blue",
    },
    {
      icon: ClipboardCheck,
      title: t("feature3Title"),
      desc: t("feature3Desc"),
      gradient: "from-emerald-500 to-green-600",
      xp: "+100 XP",
      xpClass: "xp-badge-emerald",
    },
    {
      icon: History,
      title: t("feature4Title"),
      desc: t("feature4Desc"),
      gradient: "from-orange-500 to-amber-600",
      xp: "+20 XP",
      xpClass: "xp-badge-gold",
    },
  ];

  const stats = [
    { icon: Cpu, value: "AI", label: "Gemini", color: "text-violet-500" },
    { icon: Wrench, value: "OBD2", label: "DTC", color: "text-blue-500" },
    { icon: Star, value: "3", label: "Free/mes", color: "text-amber-500" },
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

            <div className="mt-6 flex items-center justify-center gap-4">
              {stats.map((stat, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 animate-slide-up" style={{ animationDelay: `${i * 100}ms` }}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  <span className="text-sm font-bold">{stat.value}</span>
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/diagnose">
                <Button size="lg" className="gap-2 text-base px-8 animate-pulse-glow">
                  <Zap className="h-4 w-4" />
                  {t("cta")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button variant="outline" size="lg" className="gap-2 text-base">
                  <Trophy className="h-4 w-4" />
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
              className="game-card group relative overflow-hidden border-border/50 hover:border-primary/30"
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${feature.gradient} text-white shadow-lg`}
                  >
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <span className={`xp-badge ${feature.xpClass}`}>
                    {feature.xp}
                  </span>
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
            <div className="mx-auto max-w-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Diagnostic Progress</span>
                <span className="xp-badge xp-badge-emerald">Level 1</span>
              </div>
              <div className="xp-bar-track">
                <div className="xp-bar-fill bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: "0%" }} />
              </div>
              <p className="text-xs text-muted-foreground mt-1">0 / 3 free diagnostics used</p>
            </div>
            <div className="mt-8">
              <Link href="/diagnose">
                <Button size="lg" variant="outline" className="gap-2">
                  {t("startNow")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
