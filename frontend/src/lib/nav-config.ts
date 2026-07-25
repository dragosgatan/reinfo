export interface NavLink {
  href: string;
  key: string;
}

export type NavEntry =
  | { type: "link"; href: string; key: string }
  | { type: "group"; key: string; items: NavLink[] };

export const NAV_ENTRIES: NavEntry[] = [
  {
    type: "group",
    key: "problemsGroup",
    items: [
      { href: "/probleme", key: "allProblems" },
      { href: "/probleme?tab=ai", key: "ai" },
      { href: "/probleme?tab=ctf", key: "ctf" },
      { href: "/probleme?tab=exercitii", key: "exercises" },
    ],
  },
  { type: "link", href: "/concursuri", key: "contests" },
  { type: "link", href: "/duel", key: "duels" },
  { type: "link", href: "/submisii", key: "submissions" },
  { type: "link", href: "/clasament", key: "leaderboard" },
  {
    type: "group",
    key: "learnGroup",
    items: [
      { href: "/invatare", key: "learning" },
      { href: "/pregatire", key: "prep" },
      { href: "/proiecte", key: "projects" },
    ],
  },
  {
    type: "group",
    key: "communityGroup",
    items: [
      { href: "/prieteni", key: "friends" },
      { href: "/clase", key: "classes" },
    ],
  },
];

function pathnameOf(href: string): string {
  return href.split("?")[0];
}

export function isNavLinkActive(pathname: string, href: string): boolean {
  const p = pathnameOf(href);
  return pathname === p || pathname.startsWith(p + "/");
}

export function isNavGroupActive(pathname: string, items: NavLink[]): boolean {
  return items.some((item) => isNavLinkActive(pathname, item.href));
}
