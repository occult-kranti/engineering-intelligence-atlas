import type { Metadata } from "next";
import "./globals.css";
import "./studio-tokens.css";
import "./office-home.css";

export const metadata: Metadata = {
  title: "Daftar — Command Studio",
  description: "Daftar brings Donna, your companies, application directory, expert panels, and connected desktop into one private office.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="blueprint">
      <body className="antialiased">{children}</body>
    </html>
  );
}
