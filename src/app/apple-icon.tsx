import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

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
          borderRadius: 36,
          background: "#263a58",
        }}
      >
        <svg width="124" height="124" viewBox="0 0 64 64">
          <path d="M10 51V23L32 8l22 15v28H10Z" fill="#f7f4ec" />
          <path d="M23 51V30h18v21" fill="#d9eee9" />
          <path
            d="M27 23h10"
            stroke="#287c76"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
