import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ro", "en", "hu"],
  defaultLocale: "ro",
  localePrefix: "as-needed",
});
