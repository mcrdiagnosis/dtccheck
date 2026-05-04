import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Car } from "lucide-react";

export function Footer() {
  const t = useTranslations("common");
  const tNav = useTranslations("nav");

  return (
    <footer className="border-t border-border/40 bg-background/50">
      <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4 px-4 py-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Car className="h-4 w-4" />
          <span>{t("appName")} &copy; {new Date().getFullYear()}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            {tNav("pricing")}
          </Link>
          <span>Powered by Google Gemini</span>
        </div>
      </div>
    </footer>
  );
}
