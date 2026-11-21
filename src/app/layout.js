import { Geist, Geist_Mono } from "next/font/google";
// Before globals.css, which themes the skeletons with the design tokens.
import "react-loading-skeleton/dist/skeleton.css";
import "./globals.css";
import { NavigationProgressBar } from "@/components/NavigationFeedback";
import { readAppearanceCookies } from "@/lib/settings";

const geistSans = Geist({ subsets: ["latin"], display: "swap", variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-geist-mono" });

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
    { media: "(prefers-color-scheme: dark)", color: "#0a0b0f" },
  ],
};

export default async function RootLayout({ children }) {
  // Applied on the server so the chosen theme paints without a flash.
  const { theme, density } = await readAppearanceCookies();

  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable}`}
      data-density={density}
      data-theme={theme === "system" ? undefined : theme}
      lang="en"
    >
      <body>
        <NavigationProgressBar />
        {children}
      </body>
    </html>
  );
}
