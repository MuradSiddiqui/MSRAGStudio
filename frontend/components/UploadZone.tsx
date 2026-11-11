"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertCircle,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  RotateCcw,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ACCEPTED_EXTENSIONS,
  MAX_UPLOAD_MB,
  isImageName,
  type IndexedDocument,
} from "@/lib/api";
import PreviewModal from "./PreviewModal";

export interface UploadItem {
  id: string;
  name: string;
  status: "uploading" | "error";
  error?: string;
}

interface Props {
  documents: IndexedDocument[];
  documentsState: "loading" | "ready" | "error";
  uploads: UploadItem[];
  recent: Set<string>;
  /** Empty = search all files. Non-empty = only these names. */
  scopedNames: string[];
  onToggleScope: (name: string) => void;
  onScopeOnly: (name: string) => void;
  onScopeAll: () => void;
  onClearScope: () => void;
  onFiles: (files: File[]) => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
  onDelete: (name: string) => Promise<void>;
  onRefresh: () => void;
}

function FileGlyph({ name, kind }: { name: string; kind?: string }) {
  const image = kind === "image" || isImageName(name);
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        image ? "bg-multi/10 text-multi" : "bg-basic/10 text-basic"
      }`}
    >
      {image ? (
        <ImageIcon className="h-4 w-4" strokeWidth={1.75} />
      ) : (
        <FileText className="h-4 w-4" strokeWidth={1.75} />
      )}
    </span>
  );
}

export default function UploadZone({
  documents,
  documentsState,
  uploads,
  recent,
  scopedNames,
  onToggleScope,
  onScopeOnly,
  onScopeAll,
  onClearScope,
  onFiles,
  onRetry,
  onDismiss,
  onDelete,
  onRefresh,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [previewing, setPreviewing] = useState<string | null>(null);
  const closePreview = useCallback(() => setPreviewing(null), []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) onFiles(Array.from(e.dataTransfer.files));
  };

  const handleDelete = async (name: string) => {
    setDeleting(name);
    try {
      await onDelete(name);
    } finally {
      setDeleting(null);
      setConfirming(null);
    }
  };

  const visible = filter
    ? documents.filter((d) => d.name.toLowerCase().includes(filter.toLowerCase()))
    : documents;
  const totalChunks = documents.reduce((sum, d) => sum + d.chunks, 0);
  const scoping = scopedNames.length > 0;
  const scopedCount = scoping ? scopedNames.length : documents.length;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={handleDrop}
        className={`group cursor-pointer rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${
          dragging
            ? "border-ink bg-raised"
            : "border-line hover:border-faint hover:bg-raised/50"
        }`}
      >
        <UploadCloud
          className={`mx-auto h-6 w-6 transition-transform ${
            dragging ? "-translate-y-0.5 text-ink" : "text-muted group-hover:-translate-y-0.5"
          }`}
          strokeWidth={1.5}
        />
        <p className="mt-2 text-sm font-medium">
          {dragging ? "Release to upload" : "Drop files or click to browse"}
        </p>
        <p className="mt-1 text-xs text-muted">
          PDF, DOCX, TXT, MD or images · up to {MAX_UPLOAD_MB} MB
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(",")}
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onFiles(Array.from(e.target.files));
            }
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-live="polite">
          {uploads.map((u) => (
            <li
              key={u.id}
              className={`flex animate-fade-up items-center gap-2.5 rounded-xl border px-2.5 py-2 ${
                u.status === "error" ? "border-danger/30 bg-danger/5" : "border-line bg-surface"
              }`}
            >
              <FileGlyph name={u.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium" title={u.name}>
                  {u.name}
                </span>
                <span
                  className={`block text-xs ${u.status === "error" ? "text-danger" : "text-muted"}`}
                >
                  {u.status === "uploading"
                    ? isImageName(u.name)
                      ? "Reading image and indexing…"
                      : "Extracting and indexing…"
                    : u.error ?? "Upload failed"}
                </span>
              </span>
              {u.status === "uploading" ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" />
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onRetry(u.id)}
                    className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink"
                    aria-label={`Retry ${u.name}`}
                    title="Retry"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismiss(u.id)}
                    className="rounded-md p-1.5 text-muted hover:bg-raised hover:text-ink"
                    aria-label={`Dismiss ${u.name}`}
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex items-center justify-between gap-2">
        <p className="eyebrow">
          Library{" "}
          {documentsState === "ready" && (
            <span className="text-faint">
              · {documents.length} file{documents.length === 1 ? "" : "s"} · {totalChunks} chunks
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md p-1 text-muted hover:bg-raised hover:text-ink"
          aria-label="Refresh library"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${documentsState === "loading" ? "animate-spin" : ""}`} />
        </button>
      </div>

      {documents.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          <span className={scoping ? "font-medium text-ink" : "text-muted"}>
            {scoping
              ? `Asking ${scopedCount} of ${documents.length}`
              : "Asking all files"}
          </span>
          <span className="text-faint">·</span>
          {scoping ? (
            <button type="button" onClick={onClearScope} className="text-muted underline-offset-2 hover:text-ink hover:underline">
              Use all
            </button>
          ) : (
            <button type="button" onClick={onScopeAll} className="text-muted underline-offset-2 hover:text-ink hover:underline">
              Select all
            </button>
          )}
        </div>
      )}

      {documents.length > 5 && (
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter files…"
          className="mt-2 w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-sm outline-none placeholder:text-faint focus:border-faint"
        />
      )}

      <div className="mt-2">
        {documentsState === "loading" && documents.length === 0 && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-11" />
            ))}
          </div>
        )}
        {documentsState === "error" && documents.length === 0 && (
          <p className="flex items-center gap-2 rounded-xl bg-raised px-3 py-3 text-xs text-muted">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Couldn&apos;t load the library. Is the backend running?
          </p>
        )}
        {documentsState === "ready" && documents.length === 0 && (
          <p className="rounded-xl bg-raised px-3 py-4 text-center text-xs text-muted">
            Nothing indexed yet. Your first upload will appear here.
          </p>
        )}
        {visible.length > 0 && (
          <ul className="-mx-1.5 max-h-[340px] space-y-0.5 overflow-y-auto">
            {visible.map((d) => {
              const checked = !scoping || scopedNames.includes(d.name);
              const dimmed = scoping && !scopedNames.includes(d.name);
              return (
                <li
                  key={d.name}
                  className={`group flex items-center gap-2 rounded-xl px-1.5 py-1.5 hover:bg-raised/70 ${
                    dimmed ? "opacity-45" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleScope(d.name)}
                    className="h-3.5 w-3.5 shrink-0 rounded border-line accent-ink"
                    aria-label={
                      scopedNames.includes(d.name)
                        ? `Exclude ${d.name} from this question`
                        : `Include ${d.name} in this question`
                    }
                    title="Include in this question"
                  />
                  <FileGlyph name={d.name} kind={d.kind} />
                  <button
                    type="button"
                    onClick={() => onToggleScope(d.name)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium" title={d.name}>
                        {d.name}
                      </span>
                      {recent.has(d.name) && (
                        <span className="shrink-0 rounded bg-accent px-1 font-mono text-[9px] font-semibold uppercase text-accent-ink">
                          new
                        </span>
                      )}
                    </span>
                    <span className="block font-mono text-[11px] text-faint">
                      {d.kind === "image" ? "image" : `${d.chunks} chunk${d.chunks === 1 ? "" : "s"}`}
                    </span>
                  </button>
                  {confirming === d.name ? (
                    <span className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDelete(d.name)}
                        disabled={deleting === d.name}
                        className="rounded-md bg-danger px-2 py-1 text-[11px] font-medium text-white disabled:opacity-60"
                      >
                        {deleting === d.name ? "Removing…" : "Remove"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(null)}
                        className="rounded-md px-1.5 py-1 text-[11px] text-muted hover:text-ink"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                      <button
                        type="button"
                        onClick={() => onScopeOnly(d.name)}
                        className="rounded-md px-1.5 py-1 font-mono text-[10px] text-muted hover:bg-surface hover:text-ink"
                        title="Ask using only this file"
                      >
                        Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewing(d.name)}
                        className="rounded-md p-1.5 text-muted hover:bg-surface hover:text-ink"
                        aria-label={`Preview ${d.name}`}
                        title="Preview"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(d.name)}
                        className="rounded-md p-1.5 text-faint hover:bg-surface hover:text-danger"
                        aria-label={`Remove ${d.name} from the index`}
                        title="Remove from index"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {filter && visible.length === 0 && documents.length > 0 && (
          <p className="px-1 py-3 text-xs text-muted">No files match “{filter}”.</p>
        )}
      </div>
      {previewing && <PreviewModal name={previewing} onClose={closePreview} />}
    </div>
  );
}
