import { Link } from "@/i18n/navigation";
import { SearchBar } from "./search-bar";
import { LanguageSwitcher } from "./language-switcher";
import { UserMenu } from "./user-menu";
import { NavMobile } from "./nav-mobile";
import { ThemeToggle } from "./theme-toggle";
import { NavDesktop } from "./nav-desktop";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="text-primary">Re</span>Info
        </Link>

        <NavDesktop />

        <div className="ml-auto flex items-center gap-1">
          <SearchBar />
          <ThemeToggle />
          <LanguageSwitcher />
          <UserMenu />
          <NavMobile />
        </div>
      </div>
    </header>
  );
}
