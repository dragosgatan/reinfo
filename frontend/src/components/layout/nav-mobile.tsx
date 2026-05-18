"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/probleme", key: "problems" },
  { href: "/submisii", key: "submissions" },
  { href: "/concursuri", key: "contests" },
  { href: "/duel", key: "duels" },
  { href: "/invatare", key: "learning" },
  { href: "/clasament", key: "leaderboard" },
] as const;

export function NavMobile() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Închide meniu" : "Deschide meniu"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {open && (
        <div className="absolute inset-x-0 top-12 z-50 border-b border-border bg-background px-4 py-3 shadow-sm">
          <nav className="flex flex-col gap-1">
            {navItems.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  pathname === href || pathname.startsWith(href + "/")
                    ? "text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {t(key)}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
