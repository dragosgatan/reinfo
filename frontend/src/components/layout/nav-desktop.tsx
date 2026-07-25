"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { NAV_ENTRIES, isNavGroupActive, isNavLinkActive } from "@/lib/nav-config";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function NavDesktop() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center ml-3" aria-label={t("mainLabel")}>
      {NAV_ENTRIES.map((entry) => {
        if (entry.type === "link") {
          const isActive = isNavLinkActive(pathname, entry.href);
          return (
            <Link
              key={entry.href}
              href={entry.href as Parameters<typeof Link>[0]["href"]}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "px-3 py-2 text-sm transition-colors",
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(entry.key)}
            </Link>
          );
        }

        const groupActive = isNavGroupActive(pathname, entry.items);
        return (
          <DropdownMenu key={entry.key}>
            <DropdownMenuTrigger
              className={cn(
                "flex items-center gap-1 rounded-sm px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                groupActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(entry.key)}
              <ChevronDown className="h-3 w-3" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {entry.items.map((item) => {
                const isActive = isNavLinkActive(pathname, item.href);
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      href={item.href as Parameters<typeof Link>[0]["href"]}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(isActive && "font-medium text-primary")}
                    >
                      {t(item.key)}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
