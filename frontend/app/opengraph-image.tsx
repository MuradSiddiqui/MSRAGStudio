import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MS RAG Studio — cited answers from your documents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#0c0c0b",
          color: "#f2f1ec",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            right: -120,
            top: -120,
            width: 480,
            height: 480,
            borderRadius: 999,
            background: "#c8f135",
            opacity: 0.18,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -80,
            bottom: -160,
            width: 360,
            height: 360,
            borderRadius: 999,
            background: "#22d3ee",
            opacity: 0.1,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#f2f1ec",
              color: "#0c0c0b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            MS
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 28, fontWeight: 600, letterSpacing: -0.5 }}>
              MS RAG Studio
            </div>
            <div style={{ fontSize: 18, color: "#9a988f" }}>
              Basic · Multimodal · Agentic
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 980 }}>
          <div
            style={{
              fontSize: 64,
              fontWeight: 650,
              letterSpacing: -2.2,
              lineHeight: 1.05,
            }}
          >
            Answers you can trace back to the page.
          </div>
          <div style={{ fontSize: 26, color: "#9a988f", lineHeight: 1.35, maxWidth: 820 }}>
            Upload PDFs, drawings and notes. Ask in plain language. Every claim
            cites the exact source.
          </div>
        </div>

        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "Basic", color: "#fb923c" },
            { label: "Multimodal", color: "#22d3ee" },
            { label: "Agentic", color: "#a3e635" },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 18px",
                borderRadius: 999,
                border: "1px solid #2b2b26",
                background: "#151513",
                fontSize: 20,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: m.color,
                }}
              />
              {m.label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
