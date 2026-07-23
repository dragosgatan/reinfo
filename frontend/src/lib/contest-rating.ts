/** Purely cosmetic rating tiers for the contest_rating number, loosely modeled on
 * the familiar Codeforces color-tier convention. Display-only - the backend rating
 * math (app/contest_rating.py) doesn't know or care about these labels. */

export interface RatingTier {
  title: string;
  colorClass: string;
}

const TIERS: { min: number; title: string; colorClass: string }[] = [
  { min: 2400, title: "Grandmaster", colorClass: "text-red-500" },
  { min: 2100, title: "Master", colorClass: "text-orange-500" },
  { min: 1900, title: "Candidate Master", colorClass: "text-violet-500" },
  { min: 1600, title: "Expert", colorClass: "text-blue-500" },
  { min: 1400, title: "Specialist", colorClass: "text-cyan-500" },
  { min: 1200, title: "Pupil", colorClass: "text-success" },
  { min: 0, title: "Novice", colorClass: "text-muted-foreground" },
];

export function getRatingTier(rating: number): RatingTier {
  const tier = TIERS.find((t) => rating >= t.min) ?? TIERS[TIERS.length - 1];
  return { title: tier.title, colorClass: tier.colorClass };
}
