import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "POLITIQUE — Le réseau social politique de la Côte d'Ivoire";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          background: "#FFFFFF",
          color: "#16181C",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", width: 56, height: 56, borderRadius: 14, overflow: "hidden", border: "2px solid #E6E3DD" }}>
            <div style={{ flex: 1, background: "#F07C00" }} />
            <div style={{ flex: 1, background: "#FFFFFF" }} />
            <div style={{ flex: 1, background: "#0A7A4A" }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: 8 }}>POLITIQUE</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
            La parole des citoyens,
          </div>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, color: "#0A6B43" }}>
            en face de leurs élus.
          </div>
          <div style={{ fontSize: 28, color: "#5B6168", marginTop: 10 }}>
            Le réseau social politique de la Côte d&apos;Ivoire · Bientôt
          </div>
        </div>
      </div>
    ),
    size,
  );
}
