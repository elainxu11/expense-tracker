import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
  title: "Anchor",
  description: "Personal finance tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased light`}
    >
      <body className="min-h-full flex flex-col bg-white text-slate-900">
        <nav className="bg-blue-600 shadow-md">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="text-2xl font-bold text-white">Anchor</div>
            <div className="flex gap-8">
              <Link href="/" className="text-white hover:text-blue-100 text-sm font-semibold">Dashboard</Link>
              <Link href="/upload" className="text-white hover:text-blue-100 text-sm font-semibold">Upload</Link>
              <Link href="/history" className="text-white hover:text-blue-100 text-sm font-semibold">History</Link>
              <Link href="/coverage" className="text-white hover:text-blue-100 text-sm font-semibold">Coverage</Link>
              <Link href="/income" className="text-white hover:text-blue-100 text-sm font-semibold">Income</Link>
              <Link href="/savings" className="text-white hover:text-blue-100 text-sm font-semibold">Savings</Link>
              <Link href="/tax" className="text-white hover:text-blue-100 text-sm font-semibold">Tax</Link>
              <Link href="/settings" className="text-white hover:text-blue-100 text-sm font-semibold">Settings</Link>
            </div>
          </div>
        </nav>
        <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
