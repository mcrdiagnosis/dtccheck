"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { User, CreditCard, Brain, Eye, EyeOff, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getAIConfig, saveAIConfig, type AIProvider } from "@/lib/ai-provider";

export default function SettingsPage() {
  const t = useTranslations("nav");
  const tSettings = useTranslations("settings");

  const [provider, setProvider] = useState<AIProvider>("gemini");
  const [geminiKey, setGeminiKey] = useState("");
  const [zaiKey, setZaiKey] = useState("");
  const [zaiBaseUrl, setZaiBaseUrl] = useState("https://open.bigmodel.cn/api/paas/v4");
  const [zaiModel, setZaiModel] = useState("glm-4-flash");
  const [showKeys, setShowKeys] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const config = getAIConfig();
    setProvider(config.provider);
    setGeminiKey(config.geminiKey);
    setZaiKey(config.zaiKey);
    setZaiBaseUrl(config.zaiBaseUrl);
    setZaiModel(config.zaiModel);
  }, []);

  const handleSave = () => {
    saveAIConfig({ provider, geminiKey, zaiKey, zaiBaseUrl, zaiModel });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">{t("settings")}</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              {tSettings("profile")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input disabled placeholder="user@email.com" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {tSettings("currentPlan")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Badge variant="outline">Free</Badge>
              </div>
              <Link href="/pricing">
                <Button variant="outline" size="sm">{tSettings("changePlan")}</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              {tSettings("aiProvider")}
            </CardTitle>
            <CardDescription>{tSettings("aiProviderDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setProvider("gemini")}
                className={`p-4 rounded-xl border-2 transition-all text-left ${provider === "gemini" ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-6 rounded bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-500">G</div>
                  <span className="font-semibold text-sm">Google Gemini</span>
                </div>
                <p className="text-[10px] text-muted-foreground">gemini-2.5-flash • Visión nativa • Google Search</p>
              </button>
              <button
                onClick={() => setProvider("zai")}
                className={`p-4 rounded-xl border-2 transition-all text-left ${provider === "zai" ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-6 w-6 rounded bg-emerald-500/10 flex items-center justify-center text-xs font-bold text-emerald-500">Z</div>
                  <span className="font-semibold text-sm">Z.ai / GLM</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{zaiModel} • OpenAI-compatible API</p>
              </button>
            </div>

            <Separator />

            {provider === "gemini" && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">{tSettings("geminiKey")}</Label>
                <div className="relative">
                  <Input
                    type={showKeys ? "text" : "password"}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIza..."
                  />
                  <button onClick={() => setShowKeys(!showKeys)} className="absolute right-2 top-1/2 -translate-y-1/2">
                    {showKeys ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">{tSettings("geminiKeyHint")}</p>
              </div>
            )}

            {provider === "zai" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tSettings("zaiKey")}</Label>
                  <div className="relative">
                    <Input
                      type={showKeys ? "text" : "password"}
                      value={zaiKey}
                      onChange={(e) => setZaiKey(e.target.value)}
                      placeholder="xxxxxxxx.xxxxxxxx"
                    />
                    <button onClick={() => setShowKeys(!showKeys)} className="absolute right-2 top-1/2 -translate-y-1/2">
                      {showKeys ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tSettings("zaiBaseUrl")}</Label>
                  <Input value={zaiBaseUrl} onChange={(e) => setZaiBaseUrl(e.target.value)} placeholder="https://open.bigmodel.cn/api/paas/v4" />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">{tSettings("zaiModel")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {["glm-4-flash", "glm-4-plus", "glm-4-air", "glm-4-long"].map((m) => (
                      <button
                        key={m}
                        onClick={() => setZaiModel(m)}
                        className={`px-3 py-2 rounded-lg border text-xs font-mono transition-all ${zaiModel === m ? "border-primary bg-primary/5" : "border-border/50 hover:border-border"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Button onClick={handleSave} className="w-full gap-2">
              {saved ? <><Check className="h-4 w-4" />{tSettings("saved")}</> : tSettings("save")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
