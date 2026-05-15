import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  const t = useTranslations("nav");

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          <div className="col-span-2 sm:col-span-1">
            <Link href="/" className="font-bold">
              <span className="text-foreground/50">Re</span>Info
            </Link>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Platformă modernă de programare competitivă pentru elevi din România.
            </p>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Platformă
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/probleme" className="hover:text-foreground transition-colors">
                  {t("problems")}
                </Link>
              </li>
              <li>
                <Link href="/concursuri" className="hover:text-foreground transition-colors">
                  {t("contests")}
                </Link>
              </li>
              <li>
                <Link href="/invatare" className="hover:text-foreground transition-colors">
                  {t("learning")}
                </Link>
              </li>
              <li>
                <Link href="/clasament" className="hover:text-foreground transition-colors">
                  {t("leaderboard")}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cont
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/login" className="hover:text-foreground transition-colors">
                  Autentificare
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-foreground transition-colors">
                  Înregistrare
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Proiect
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="https://infoeducatie.ro"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  InfoEducație
                </a>
              </li>
              <li>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} ReInfo. Toate drepturile rezervate.</p>
          <p>Proiect InfoEducație — Secțiunea Software Educațional</p>
        </div>
      </div>
    </footer>
  );
}
