import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-28 text-center">
      <p className="eyebrow">Error 404</p>
      <h1 className="mt-4 font-display text-5xl font-semibold tracking-tight">
        No source for <span className="font-serif font-normal italic">this</span> page.
      </h1>
      <p className="mt-4 text-muted">
        The page you asked for isn&apos;t in the index. Try the Studio instead.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn-ghost">
          Back home
        </Link>
        <Link href="/studio" className="btn-primary">
          Open Studio
        </Link>
      </div>
    </div>
  );
}
