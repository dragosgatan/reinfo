"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/probleme", key: "problems" },
  { href: "/concursuri", key: "contests" },
  { href: "/invatare", key: "learning" },
  { href: "/clasament", key: "leaderboard" },
] as const;

export function NavDesktop() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-0.5" aria-label="Principal">
      {navItems.map(({ href, key }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            pathname === href || pathname.startsWith(href + "/")
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(key)}
        </Link>
      ))}
    </nav>
  );
}
