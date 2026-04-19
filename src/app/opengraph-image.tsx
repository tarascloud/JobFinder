import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "JobFinder — AI-Powered Job Search Automation";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#26282b",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Border accent */}
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            right: 8,
            bottom: 8,
            border: "3px solid rgba(255, 214, 0, 0.25)",
            borderRadius: 24,
            display: "flex",
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: "#ffd600",
              display: "flex",
            }}
          >
            JF
          </div>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              border: "4px solid #FFA800",
              display: "flex",
            }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: "#ffffff",
            display: "flex",
            textAlign: "center",
          }}
        >
          JobFinder
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 24,
            color: "#FFA800",
            marginTop: 16,
            display: "flex",
            textAlign: "center",
          }}
        >
          AI-Powered Job Search & Auto-Apply
        </div>

        {/* Features */}
        <div
          style={{
            display: "flex",
            gap: 32,
            marginTop: 40,
            color: "rgba(255, 255, 255, 0.7)",
            fontSize: 18,
          }}
        >
          <span style={{ display: "flex" }}>11+ Job Boards</span>
          <span style={{ display: "flex" }}>•</span>
          <span style={{ display: "flex" }}>AI Match Scoring</span>
          <span style={{ display: "flex" }}>•</span>
          <span style={{ display: "flex" }}>Auto-Apply</span>
          <span style={{ display: "flex" }}>•</span>
          <span style={{ display: "flex" }}>Open Source</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
