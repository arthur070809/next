import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    authInterrupts: true,
  },
  async headers() {
    return [
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
