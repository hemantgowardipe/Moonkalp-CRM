import "./globals.css";
import { readAppearanceCookies } from "@/lib/settings";

export const metadata = {
  title: "Moonkalp CRM",
  description: "Client, deliverables, and billing management for your agency.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

export default async function RootLayout({ children }) {
  // Applied on the server so the chosen theme paints without a flash.
  const { theme, density } = await readAppearanceCookies();

  return (
    <html data-density={density} data-theme={theme === "system" ? undefined : theme} lang="en">
      <body>{children}</body>
    </html>
  );
}
