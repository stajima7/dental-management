import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "歯科経営ダッシュボード",
  description: "歯科医院の経営を見える化し、改善アクションまで提案する経営コンサルアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${geistSans.variable}`} style={{ height: "100%" }}>
      <body className="font-sans antialiased" style={{ minHeight: "100%", margin: 0, background: "#f9fafb" }}>{children}</body>
    </html>
  );
}
