"use client";

import { useRef, useState } from "react";
import type { UploadedFile } from "@/lib/api";

interface Props {
  files: UploadedFile[];
  onFiles: (files: File[]) => void;
  onRemove: (name: string) => void;
}

/** Extensions the backend extractor actually handles (extract.py / pipeline.py). */
const ACCEPT = ".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp";
const IMAGE_EXTS = [".png", ".jpg", ".jpeg", ".webp"];

function isImageName(name: string) {
  const lower = name.toLowerCase();
  return IMAGE_EXTS.some((ext) => lower.endsWith(ext));
}

export default function UploadZone({ files, onFiles, onRemove }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      onFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragging
            ? "border-indigo-400 bg-indigo-50"
            : "border-slate-300 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50"
        }`}
      >
        <p className="text-sm font-medium text-slate-700">
          Drop files here, or click to browse
        </p>
        <p className="mt-1 text-xs text-slate-500">
          PDF, DOCX, TXT, or images (PNG, JPG, WebP). Images are read by the
          vision model and indexed as text.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFiles(Array.from(e.target.files));
            }
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f) => (
            <li
              key={f.name}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white ${
                  isImageName(f.name) ? "bg-violet-500" : "bg-indigo-500"
                }`}
              >
                {isImageName(f.name) ? "IMG" : "DOC"}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">
                  {f.name}
                </span>
                <span className="block text-xs text-slate-500">
                  {f.status === "uploading" && "Uploading and indexing..."}
                  {f.status === "done" &&
                    (f.chunks && f.chunks > 0
                      ? `Indexed, ${f.chunks} chunk${f.chunks === 1 ? "" : "s"}`
                      : "Uploaded, but no readable content was found")}
                  {f.status === "error" && (f.error ?? "Upload failed")}
                </span>
              </span>
              {f.status === "uploading" && (
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" />
              )}
              {f.status === "done" && (
                <span className="shrink-0 text-sm text-emerald-600">✓</span>
              )}
              {f.status === "error" && (
                <span className="shrink-0 text-sm text-red-500">!</span>
              )}
              <button
                type="button"
                onClick={() => onRemove(f.name)}
                title="Remove from this list. The backend has no delete endpoint, so chunks already indexed stay in the index."
                className="shrink-0 rounded px-1.5 py-0.5 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label={`Remove ${f.name} from list`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
