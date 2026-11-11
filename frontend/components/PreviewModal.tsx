"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, ExternalLink, Loader2, X } from "lucide-react";
import { fetchPreview, type Preview } from "@/lib/api";

interface Props {
  name: string;
  onClose: () => void;
}

export default function PreviewModal({ name, onClose }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;
    setPreview(null);
    setError(null);
    fetchPreview(name, controller.signal)
      .then((p) => {
        if (p.kind === "file") url = p.url;
        setPreview(p);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Couldn't load the preview.");
      });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [name]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${name}`}
        className="flex h-[min(88vh,900px)] w-full max-w-4xl animate-fade-up flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <p className="min-w-0 flex-1 truncate text-sm font-medium" title={name}>
            {name}
          </p>
          {preview?.kind === "file" && (
            <a
              href={preview.url}
              target="_blank"
              rel="noreferrer"
              className="btn-quiet py-1 text-xs"
              title="Open in a new tab"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open
            </a>
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink"
            aria-label="Close preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-canvas">
          {!preview && !error && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading preview…
            </div>
          )}
          {error && (
            <div className="flex h-full items-center justify-center gap-2 px-6 text-center text-sm text-muted">
              <AlertCircle className="h-4 w-4 shrink-0 text-danger" /> {error}
            </div>
          )}
          {preview?.kind === "file" &&
            (preview.mime.startsWith("image/") ? (
              <div className="flex h-full items-center justify-center p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob URL */}
                <img src={preview.url} alt={name} className="max-h-full max-w-full rounded-lg object-contain" />
              </div>
            ) : (
              <iframe src={preview.url} title={name} className="h-full w-full border-0" />
            ))}
          {preview?.kind === "image" && (
            <div className="p-5">
              <Notice>
                The original image is no longer stored on the server, so this is the description
                the vision model indexed for it.
              </Notice>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed">{preview.description}</p>
            </div>
          )}
          {preview?.kind === "text" && (
            <div className="space-y-5 p-5">
              {!preview.stored && (
                <Notice>
                  The original file is no longer stored on the server, so this shows the text that
                  was indexed from it.
                </Notice>
              )}
              {preview.pages.length === 0 && (
                <p className="text-sm text-muted">No readable text in this file.</p>
              )}
              {preview.pages.map((p) => (
                <section key={p.page}>
                  {preview.pages.length > 1 && (
                    <p className="eyebrow mb-1.5">Page {p.page}</p>
                  )}
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{p.text}</p>
                </section>
              ))}
              {preview.truncated && (
                <p className="text-xs text-muted">Preview cut short; the full file is still indexed.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl bg-raised px-3 py-2 text-xs text-muted">{children}</p>
  );
}
