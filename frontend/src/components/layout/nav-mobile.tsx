"use client";

import { useEffect, useRef, useState } from "react";
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
  { href: "/pregatire", key: "prep" },
  { href: "/clasament", key: "leaderboard" },
  { href: "/prieteni", key: "friends" },
  { href: "/clase", key: "classes" },
] as const;

export function NavMobile() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (open) {
      firstLinkRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  return (
    <div className="md:hidden">
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        onClick={() => setOpen(!open)}
        aria-label={open ? t("mobileMenuClose") : t("mobileMenuOpen")}
        aria-expanded={open}
        aria-controls="mobile-nav-menu"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {open && (
        <div
          id="mobile-nav-menu"
          className="absolute inset-x-0 top-12 z-50 border-b border-border bg-background px-4 py-3 shadow-sm"
        >
          <nav aria-label={t("mainLabel")}>
            <ul className="flex flex-col gap-1" role="list">
              {navItems.map(({ href, key }, i) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");
                return (
                  <li key={href}>
                    <Link
                      ref={i === 0 ? firstLinkRef : undefined}
                      href={href}
                      onClick={close}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "text-primary font-medium"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      {t(key)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
