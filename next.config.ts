import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Wyłączamy client-side router cache dla wszystkich segmentów.
  // Bez tego App Router trzyma w przeglądarce stary RSC payload nawet po
  // revalidateTag/revalidatePath – publiczne strony "starzeją się" do F5.
  // Cache po stronie serwera (unstable_cache + getPublicCacheKey) zostaje aktywny.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
