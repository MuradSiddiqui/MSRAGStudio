import { Suspense } from "react";
import type { Metadata } from "next";
import Studio from "@/components/Studio";

export const metadata: Metadata = {
  title: "Studio",
  description:
    "Upload documents and images, ask in four retrieval modes, and download cited reports.",
};

export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
          <div className="skeleton h-8 w-40" />
          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            <div className="skeleton h-72 rounded-2xl" />
            <div className="skeleton h-40 rounded-2xl" />
          </div>
        </div>
      }
    >
      <Studio />
    </Suspense>
  );
}
