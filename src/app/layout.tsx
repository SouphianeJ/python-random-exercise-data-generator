import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}
