import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string, locale = "ro-RO"): string {
  return new Date(dateString).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function resolveMediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return `${base}${path}`;
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "azi";
  if (diffDays === 1) return "ieri";
  if (diffDays < 7) return `acum ${diffDays} zile`;
  if (diffDays < 30) return `acum ${Math.floor(diffDays / 7)} săptămâni`;
  return formatDate(dateString);
}
