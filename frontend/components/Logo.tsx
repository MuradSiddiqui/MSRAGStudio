import Link from "next/link";

export function LogoMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-ink" />
      <path
        d="M9 22V10l7 7 7-7v12"
        fill="none"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-canvas"
      />
      <circle cx="24.5" cy="7.5" r="3.5" className="fill-accent" />
    </svg>
  );
}

export default function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="MS RAG Studio home">
      <LogoMark />
      <span className="font-display text-[15px] font-semibold tracking-tight">
        MS RAG <span className="text-muted transition-colors group-hover:text-ink">Studio</span>
      </span>
    </Link>
  );
}
