import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { profile } from "@/data/profile";

export const alt = `${profile.name} — ${profile.title}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const portrait = await readFile(join(process.cwd(), "public/images/hugo-portrait.jpg"));
  const src = `data:image/jpeg;base64,${portrait.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          padding: "0 90px",
          gap: 64,
          background: "linear-gradient(180deg, #f6d9b8 0%, #d8edf2 46%, #2e6f8e 100%)",
          color: "#16324a",
        }}
      >
        <img
          src={src}
          width={300}
          height={300}
          alt=""
          style={{ borderRadius: 300, border: "10px solid #faf5e9" }}
        />
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 680 }}>
          <div style={{ fontSize: 26, letterSpacing: 8, textTransform: "uppercase", opacity: 0.6 }}>
            Ria de Aveiro · Portfolio
          </div>
          <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1.05, marginTop: 12 }}>
            {profile.name}
          </div>
          <div style={{ fontSize: 38, marginTop: 14 }}>{profile.title}</div>
          <div style={{ fontSize: 26, marginTop: 28, opacity: 0.75 }}>
            Eye tracking · usability evaluation · XR — sail a moliceiro through my work
          </div>
        </div>
      </div>
    ),
    size
  );
}
