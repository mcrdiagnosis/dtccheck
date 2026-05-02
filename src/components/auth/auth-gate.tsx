"use client";

import { useState, useEffect } from "react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AuthGateProps {
  children: React.ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      setChecking(false);
    };
    check();
  }, []);

  if (checking) {
    return <div className="relative">{children}</div>;
  }

  if (isLoggedIn) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="blur-md select-none pointer-events-none overflow-hidden">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <Card className="w-full max-w-md mx-4 border-primary/20 shadow-xl">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Resultado del diagnóstico</h2>
            <p className="text-muted-foreground">
              El análisis se completó correctamente. Crea una cuenta gratuita para ver el resultado completo con todas las soluciones, pruebas y recomendaciones.
            </p>
            <div className="space-y-3 pt-2">
              <Link href="/register">
                <Button className="w-full gap-2" size="lg">
                  <Zap className="h-4 w-4" />
                  Ver resultado - Es gratis
                </Button>
              </Link>
              <Link href="/login">
                <Button variant="outline" className="w-full" size="lg">
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>
            <p className="text-xs text-muted-foreground pt-2">
              Sin tarjeta de crédito. Cuenta gratuita con 3 diagnósticos al mes.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
