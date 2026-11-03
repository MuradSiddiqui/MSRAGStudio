import type { Metadata, Viewport } from "next";
import {
  Bricolage_Grotesque,
  Instrument_Serif,
  Inter_Tight,
  JetBrains_Mono,
} from "next/font/google";
import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});
const body = Inter_Tight({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://ms-rag-studio-muradsiddiqui.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MS RAG Studio: cited answers from your documents",
    template: "%s · MS RAG Studio",
  },
  description:
    "Upload PDFs, drawings and notes. Ask in Basic, Multimodal or Agentic mode and get answers with page-level citations you can verify.",
  applicationName: "MS RAG Studio",
  keywords: [
    "RAG",
    "retrieval augmented generation",
    "document Q&A",
    "citations",
    "multimodal",
    "agentic RAG",
  ],
  authors: [{ name: "Murad Siddiqui" }],
  creator: "Murad Siddiqui",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "MS RAG Studio",
    title: "MS RAG Studio",
    description:
      "Answers you can trace back to the page — Basic, Multimodal and Agentic RAG in one studio.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MS RAG Studio",
    description:
      "Ask your documents anything. Every answer cites the exact page or image.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0c0b" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable} ${serif.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <ThemeProvider>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-canvas"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p>
                <span className="font-display font-semibold text-ink">MS RAG Studio</span>{" "}
                · Basic, Multimodal and Agentic RAG in one workspace.
              </p>
              <div className="flex items-center gap-4">
                <Link href="/studio" className="hover:text-ink">
                  Studio
                </Link>
                <Link href="/#how-it-works" className="hover:text-ink">
                  How it works
                </Link>
                <span className="font-mono text-xs text-faint">© {new Date().getFullYear()}</span>
              </div>
            </div>
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
