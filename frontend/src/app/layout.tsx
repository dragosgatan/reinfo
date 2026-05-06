import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReInfo – Programare Competitivă",
  description:
    "Platformă modernă de programare competitivă pentru elevi și profesori din România.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
