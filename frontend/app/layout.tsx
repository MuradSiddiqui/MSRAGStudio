import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "MS RAG Studio",
  description:
    "Ask questions across your documents and images, and get answers with sources you can check.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                MS
              </span>
              <span className="text-base font-semibold tracking-tight">
                MS RAG Studio
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/"
                className="rounded-md px-3 py-2 font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                Overview
              </Link>
              <Link
                href="/studio"
                className="rounded-md bg-indigo-600 px-3 py-2 font-medium text-white hover:bg-indigo-500"
              >
                Open the Studio
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>MS RAG Studio: Basic, Multimodal and Agentic RAG in one workspace.</p>
            <p>Next.js · FastAPI · Qdrant · Groq · BGE · n8n</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
