"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Car, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tMsg = useTranslations("authMessages");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const supabase = createClient();
      if (!supabase) {
        toast.error(tMsg("notConfigured"));
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success(tMsg("loginSuccess"));
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || tMsg("loginError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto flex items-center justify-center min-h-[70vh] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Car className="h-10 w-10 text-primary mx-auto mb-2" />
          <CardTitle className="text-2xl">{t("loginTitle")}</CardTitle>
          <CardDescription>{t("hasAccount")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("email")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{t("password")}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("loginButton")}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            {t("noAccount")}{" "}
            <Link href="/register" className="text-primary hover:underline">
              {t("registerTitle")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
