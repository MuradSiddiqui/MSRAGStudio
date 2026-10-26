import { Suspense } from "react";
import type { Metadata } from "next";
import Studio from "@/components/Studio";

export const metadata: Metadata = {
  title: "Studio · MS RAG Studio",
  description:
    "Upload documents and images, ask in three retrieval modes, and download cited reports.",
};

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-slate-500 sm:px-6">
          Loading the Studio...
        </div>
      }
    >
      <Studio />
    </Suspense>
  );
}
