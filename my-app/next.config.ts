import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  async headers() {
    return [
      {
        source: "/models/human/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/almoxarifado/requisicoes/:path*",
        headers: [{ key: "Permissions-Policy", value: "camera=(self)" }],
      },
      {
        source: "/estoque/:path*",
        headers: [{ key: "Permissions-Policy", value: "camera=(self)" }],
      },
      {
        source: "/admin/estoque/:path*",
        headers: [{ key: "Permissions-Policy", value: "camera=(self)" }],
      },
      {
        source: "/almoxarifado/estoque/:path*",
        headers: [{ key: "Permissions-Policy", value: "camera=(self)" }],
      },
      {
        source: "/admin/biometria/:path*",
        headers: [{ key: "Permissions-Policy", value: "camera=(self)" }],
      },
    ];
  },
};

export default nextConfig;
