
import type { Metadata } from "next";
import { Geist_Mono, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import PublicTopMenu from '../components/navigation/PublicTopMenu';

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "KadraEpikon",
  description: "Panel administracyjny KadraEpikon",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInitScript = `(() => {
    try {
      const saved = localStorage.getItem('kadra-theme');
      const theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
      const root = document.documentElement;
      root.classList.remove('theme-light', 'theme-dark');
      root.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark');
    } catch (_) {
      document.documentElement.classList.add('theme-dark');
    }
  })();`;

  return (
    <html lang="en" className="theme-dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${geistMono.variable} ${barlowCondensed.variable} antialiased`}
      >
        {/* Górne menu publiczne */}
        <PublicTopMenu />
        {children}
      </body>
    </html>
  );
}
