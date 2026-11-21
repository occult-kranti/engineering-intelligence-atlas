import type { Metadata } from "next";
import "./globals.css";
import "./office-home.css";

export const metadata: Metadata = {
  title: "Daftar — One Office",
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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
