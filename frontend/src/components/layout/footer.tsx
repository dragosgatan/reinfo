import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  const tAuth = useTranslations("auth");
  const t = useTranslations("footer");

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="font-bold">
              ReInfo
            </Link>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{t("tagline")}</p>
          </div>

          <nav aria-label={t("sectionLegal")}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sectionLegal")}
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/confidentialitate" className="hover:text-foreground transition-colors">
                  {t("privacyPolicy")}
                </Link>
              </li>
              <li>
                <Link href="/termeni" className="hover:text-foreground transition-colors">
                  {t("termsOfService")}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={t("sectionAccount")}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sectionAccount")}
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  {tAuth("login")}
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-foreground transition-colors">
                  {tAuth("register")}
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label={t("sectionProject")}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("sectionProject")}
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://community.infoeducatie.ro/t/reinfo-educational-maramures-lucrari-2026-nationala/6630"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  InfoEducație
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/dragosgatan/reinfo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <p>{t("copyright", { year: new Date().getFullYear() })}</p>
          <p>{t("infoeducatie")}</p>
        </div>
      </div>
    </footer>
  );
}
