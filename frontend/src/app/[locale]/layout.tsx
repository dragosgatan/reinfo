import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { routing } from "@/i18n/routing";
import { Providers } from "@/providers";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import "../globals.css";

export const metadata: Metadata = {
  title: {
    default: "ReInfo – Programare Competitivă",
    template: "%s · ReInfo",
  },
  description:
    "Platformă modernă de programare competitivă pentru elevi și profesori din România.",
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <TooltipProvider>
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </TooltipProvider>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
