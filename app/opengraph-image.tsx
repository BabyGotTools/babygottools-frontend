import { ImageResponse } from "next/og";

/**
 * Default Open Graph image for routes that don't specify a page-specific one
 * (tool and hub pages set their own title/description but reuse this image
 * automatically via Next's metadata file convention). Rendered at build time
 * with the same palette as styles/themes.css — no external assets or fonts.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Baby Got Tools — free, browser-based online tools";

export default function OpengraphImage() {
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
          background: "#0f131d",
          color: "#dfe2f1",
          position: "relative",
        }}
      >
        {/* Accent glow */}
        <div
          style={{
            position: "absolute",
            top: -180,
            right: -140,
            width: 620,
            height: 620,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(93,230,255,0.14) 0%, rgba(93,230,255,0) 70%)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -220,
            left: -120,
            width: 680,
            height: 680,
            borderRadius: 9999,
            background: "radial-gradient(circle, rgba(208,188,255,0.12) 0%, rgba(208,188,255,0) 70%)",
            display: "flex",
          }}
        />

        {/* Logo chip — pure CSS diamond (no font dependency) */}
        <div
          style={{
            display: "flex",
            width: 92,
            height: 92,
            borderRadius: 24,
            background: "#171b26",
            border: "2px solid #262a35",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <div
            style={{
              display: "flex",
              width: 34,
              height: 34,
              background: "#5de6ff",
              borderRadius: 4,
              transform: "rotate(45deg)",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 68,
            fontWeight: 700,
            color: "#dfe2f1",
            letterSpacing: -2,
          }}
        >
          Baby Got Tools
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 32,
            color: "#cbc3d7",
            marginTop: 18,
          }}
        >
          Every Tool You Need. All in One Place.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 46,
            padding: "12px 28px",
            borderRadius: 9999,
            border: "1px solid #494454",
            background: "#1c1f2a",
            color: "#5de6ff",
            fontSize: 24,
          }}
        >
          free · browser-based · zero uploads
        </div>
      </div>
    ),
    size
  );
}
