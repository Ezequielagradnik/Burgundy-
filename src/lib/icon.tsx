import { ImageResponse } from "next/og";

// Ícono de la app: "B" crema sobre bordó. Se genera en PNG al vuelo.
export function brandIcon(size: number, rounded = false) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#6b1d34",
          color: "#f6f0ea",
          fontSize: size * 0.62,
          fontWeight: 700,
          borderRadius: rounded ? size * 0.22 : 0,
          letterSpacing: -size * 0.02,
        }}
      >
        B
      </div>
    ),
    { width: size, height: size },
  );
}
