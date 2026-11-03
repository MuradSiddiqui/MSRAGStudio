import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#151410",
          borderRadius: 40,
          color: "#f6f5f0",
          fontSize: 72,
          fontWeight: 700,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          position: "relative",
        }}
      >
        MS
        <div
          style={{
            position: "absolute",
            top: 28,
            right: 28,
            width: 28,
            height: 28,
            borderRadius: 999,
            background: "#c8f135",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
