import { ImageResponse } from "next/og";

export const socialImageSize = {
  width: 1200,
  height: 630,
};

export function createSocialImage({
  eyebrow,
  title,
  description,
  detail,
}: {
  eyebrow: string;
  title: string;
  description: string;
  detail?: string;
}) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#f7f4ec",
          color: "#172033",
          padding: "68px 72px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            borderRadius: 520,
            right: -150,
            top: -180,
            background: "#d9eee9",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 250,
            height: 250,
            borderRadius: 250,
            right: -80,
            bottom: -180,
            background: "#263a58",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                color: "#236b68",
                fontSize: 25,
                fontWeight: 700,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              <span
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 5,
                  background: "#4aa39b",
                  display: "flex",
                }}
              />
              {eyebrow}
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: 930,
                marginTop: 34,
                fontSize: 66,
                lineHeight: 1.05,
                letterSpacing: -2.5,
                fontWeight: 750,
              }}
            >
              {title}
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: 820,
                marginTop: 26,
                color: "#566174",
                fontSize: 28,
                lineHeight: 1.35,
              }}
            >
              {description}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 25,
              fontWeight: 700,
            }}
          >
            <div style={{ display: "flex" }}>
              BTOProjects<span style={{ color: "#287c76" }}>.sg</span>
            </div>
            {detail ? (
              <div
                style={{
                  display: "flex",
                  color: "#5d6878",
                  background: "#f7f4ec",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 22,
                  fontWeight: 500,
                }}
              >
                {detail}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    ),
    socialImageSize,
  );
}
