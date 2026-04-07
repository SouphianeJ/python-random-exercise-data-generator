import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Exercise Data Generator",
  description: "Reality-coherent retail exercise dataset generator",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className="site-nav-shell">
          <nav className="site-nav">
            <Link href="/">Donnees</Link>
            <Link href="/sujets">Sujets</Link>
          </nav>
        </div>
        {children}
      </body>
    </html>
  );
}
