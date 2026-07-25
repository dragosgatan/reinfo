"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NAV_ENTRIES, isNavLinkActive } from "@/lib/nav-config";

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

  let linkIndex = 0;

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
          className="absolute inset-x-0 top-12 z-50 max-h-[calc(100vh-3rem)] overflow-y-auto border-b border-border bg-background px-4 py-3 shadow-sm"
        >
          <nav aria-label={t("mainLabel")}>
            <ul className="flex flex-col gap-1" role="list">
              {NAV_ENTRIES.map((entry) => {
                if (entry.type === "link") {
                  const isActive = isNavLinkActive(pathname, entry.href);
                  const i = linkIndex++;
                  return (
                    <li key={entry.href}>
                      <Link
                        ref={i === 0 ? firstLinkRef : undefined}
                        href={entry.href as Parameters<typeof Link>[0]["href"]}
                        onClick={close}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {t(entry.key)}
                      </Link>
                    </li>
                  );
                }

                return (
                  <li key={entry.key} className="mt-2 first:mt-0">
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t(entry.key)}
                    </p>
                    <ul className="flex flex-col gap-1" role="list">
                      {entry.items.map((item) => {
                        const isActive = isNavLinkActive(pathname, item.href);
                        const i = linkIndex++;
                        return (
                          <li key={item.href}>
                            <Link
                              ref={i === 0 ? firstLinkRef : undefined}
                              href={item.href as Parameters<typeof Link>[0]["href"]}
                              onClick={close}
                              aria-current={isActive ? "page" : undefined}
                              className={cn(
                                "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                isActive
                                  ? "text-primary font-medium"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              {t(item.key)}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
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
