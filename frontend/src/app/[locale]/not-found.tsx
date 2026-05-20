import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

function TerminalIllustration() {
  return (
    <svg
      viewBox="0 0 340 210"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="w-full max-w-sm"
      style={{ height: "auto" }}
    >
      <rect
        x="0.75" y="0.75" width="338.5" height="208.5" rx="5.25"
        className="fill-card stroke-border" strokeWidth="1.5"
      />
      <rect
        x="0.75" y="0.75" width="338.5" height="36" rx="5.25"
        className="fill-muted"
      />
      <rect x="0.75" y="24" width="338.5" height="12.75" className="fill-muted" />
      <circle cx="22" cy="19" r="5" fill="#ff5f57" />
      <circle cx="41" cy="19" r="5" fill="#febc2e" />
      <circle cx="60" cy="19" r="5" fill="#28c840" />
      <text
        x="170" y="24" textAnchor="middle"
        fontSize="10.5" fontFamily="ui-monospace, 'SF Mono', monospace"
        className="fill-muted-foreground"
      >
        bash
      </text>
      <line
        x1="0.75" y1="36.75" x2="339.25" y2="36.75"
        className="stroke-border" strokeWidth="0.75"
      />
      <text x="18" y="70" fontSize="12" fontFamily="ui-monospace, 'SF Mono', monospace">
        <tspan fill="#22c55e">~/reinfo</tspan>
        <tspan className="fill-muted-foreground">{" % "}</tspan>
        <tspan className="fill-foreground">find /pagina-ta</tspan>
      </text>
      <text x="18" y="96" fontSize="12" fontFamily="ui-monospace, 'SF Mono', monospace">
        <tspan className="fill-muted-foreground">find: </tspan>
        <tspan fill="#ef4444">/pagina-ta</tspan>
        <tspan className="fill-muted-foreground">: No such file or directory</tspan>
      </text>
      <text
        x="18" y="120" fontSize="11.5"
        fontFamily="ui-monospace, 'SF Mono', monospace"
        opacity="0.65"
      >
        <tspan className="fill-muted-foreground">exit status </tspan>
        <tspan fill="#ef4444">1</tspan>
        <tspan className="fill-muted-foreground">{"  # eroare "}</tspan>
        <tspan fill="#ef4444" fontWeight="700">404</tspan>
      </text>
      <text x="18" y="158" fontSize="12" fontFamily="ui-monospace, 'SF Mono', monospace">
        <tspan fill="#22c55e">~/reinfo</tspan>
        <tspan className="fill-muted-foreground">{" % "}</tspan>
        <tspan className="fill-foreground">█</tspan>
      </text>
    </svg>
  );
}

export default async function NotFound() {
  const t = await getTranslations("notFound");

  return (
    <div className="flex min-h-[calc(100vh-48px)] flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center">
          <TerminalIllustration />
        </div>
        <p className="mb-2 font-mono text-xs text-muted-foreground">{t("errorCode")}</p>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("subtitle")}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="sm">
            <Link href="/">{t("home")}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/probleme">{t("problems")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
