"use client";

import { useEffect, useState } from "react";

export default function BuildIdentifier() {
  const [buildId, setBuildId] = useState("consultando versão");

  useEffect(() => {
    let active = true;
    void fetch("/api/diagnostics/build", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível consultar a versão.");
        const payload = await response.json() as { buildId?: unknown };
        if (typeof payload.buildId !== "string") throw new Error("Identificador de versão inválido.");
        if (active) setBuildId(payload.buildId);
      })
      .catch(() => {
        if (active) setBuildId("versão indisponível");
      });
    return () => { active = false; };
  }, []);

  return <p className="text-center text-xs text-text-secondary" aria-label="Identificador da versão">
    Versão: {buildId}
  </p>;
}
