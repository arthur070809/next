import { describe, expect, it, vi } from "vitest";
import { carregarPlanoViagem, viagemDemoDisponivel } from "./demo-mode";

describe("modo de demonstração de viagens", () => {
  it("fica disponível fora de produção ou quando habilitado explicitamente", () => {
    expect(viagemDemoDisponivel("development", undefined)).toBe(true);
    expect(viagemDemoDisponivel("test", "false")).toBe(true);
    expect(viagemDemoDisponivel("production", "true")).toBe(true);
    expect(viagemDemoDisponivel("production", "false")).toBe(false);
    expect(viagemDemoDisponivel("production", undefined)).toBe(false);
  });

  it("não chama a fonte de dados real em modo de demonstração", async () => {
    const buscarPlanoReal = vi.fn();
    const plano = await carregarPlanoViagem(true, buscarPlanoReal);

    expect(buscarPlanoReal).not.toHaveBeenCalled();
    expect(plano.metricas).toEqual({
      idasSemAgrupar: 12,
      idasAgrupadas: 3,
      idasEconomizadas: 9,
    });
  });

  it("usa a fonte de dados real quando o modo de demonstração está desligado", async () => {
    const planoReal = {
      viagens: [],
      metricas: { idasSemAgrupar: 0, idasAgrupadas: 0, idasEconomizadas: 0 },
    };
    const buscarPlanoReal = vi.fn().mockResolvedValue(planoReal);

    await expect(carregarPlanoViagem(false, buscarPlanoReal)).resolves.toBe(planoReal);
    expect(buscarPlanoReal).toHaveBeenCalledOnce();
  });
});
