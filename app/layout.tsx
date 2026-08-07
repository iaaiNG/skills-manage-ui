import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Skills 控制中心 // 水晶玻璃拟态终端",
  description: "基于 Next.js 与 Antigravity CLI 的可视化技能管理控制台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased light`}
    >
      <body className="min-h-full flex flex-col bg-[#f8fafc] text-slate-900 font-sans selection:bg-purple-500 selection:text-white relative">
        {/* Animated Pastel Ambient Gradient Blobs for Light Glassmorphism */}
        <div className="ambient-blob-1" aria-hidden="true" />
        <div className="ambient-blob-2" aria-hidden="true" />
        <div className="ambient-blob-3" aria-hidden="true" />
        
        <div className="relative z-10 min-h-full flex flex-col">
          {children}
        </div>
      </body>
    </html>
  );
}
