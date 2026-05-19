"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/probleme", key: "problems" },
  { href: "/submisii", key: "submissions" },
  { href: "/concursuri", key: "contests" },
  { href: "/duel", key: "duels" },
  { href: "/invatare", key: "learning" },
  { href: "/clasament", key: "leaderboard" },
  { href: "/prieteni", key: "friends" },
  { href: "/clase", key: "classes" },
] as const;

export function NavDesktop() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center ml-3" aria-label="Principal">
      {navItems.map(({ href, key }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "px-3 py-2 text-sm transition-colors",
              isActive
                ? "text-primary font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
