/** purely cosmetic rating tiers for contest_rating, loosely modeled on codeforces color tiers; display-only */

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
