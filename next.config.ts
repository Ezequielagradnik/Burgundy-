import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Las pestañas ya visitadas se muestran al instante. Guardar algo refresca la caché (revalidatePath).
    staleTimes: { dynamic: 60, static: 300 },
  },
};

export default nextConfig;
