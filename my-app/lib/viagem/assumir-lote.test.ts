import { describe, expect, it, vi } from "vitest";
import { ExecutorAssuncaoLote } from "./assumir-lote";

function response(status: number, body: object): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("ExecutorAssuncaoLote", () => {
  it("segue após sucesso, 409 e falha de rede, enviando o crachá em cada chamada", async () => {
    const executor = new ExecutorAssuncaoLote();
    const requisicoes = ["REQ-1", "REQ-2", "REQ-3"].map((numeroPedido) => ({ numeroPedido }));
    const chamadas: string[] = [];
    const assumir = vi.fn(async (requisicao: { numeroPedido: string }, cracha: string) => {
      chamadas.push(`${requisicao.numeroPedido}:${cracha}`);
      if (requisicao.numeroPedido === "REQ-1") return response(200, {});
      if (requisicao.numeroPedido === "REQ-2") {
        return response(409, { error: "Já assumida", assumidaPor: "Joana" });
      }
      throw new Error("rede indisponível");
    });

    await expect(executor.executar(requisicoes, "CRACHA-7", assumir)).resolves.toEqual([
      { numeroPedido: "REQ-1", tipo: "assumida" },
      { numeroPedido: "REQ-2", tipo: "ja-assumida", atendente: "Joana" },
      {
        numeroPedido: "REQ-3",
        tipo: "erro",
        mensagem: "Falha de comunicação ao assumir a requisição.",
      },
    ]);
    expect(chamadas).toEqual(["REQ-1:CRACHA-7", "REQ-2:CRACHA-7", "REQ-3:CRACHA-7"]);
  });

  it("ignora uma segunda execução concorrente", async () => {
    const executor = new ExecutorAssuncaoLote();
    let liberarResposta: ((resposta: Response) => void) | undefined;
    const assumir = vi.fn(() => new Promise<Response>((resolve) => {
      liberarResposta = resolve;
    }));
    const requisicoes = [{ numeroPedido: "REQ-1" }];

    const primeira = executor.executar(requisicoes, "CRACHA-7", assumir);
    await expect(executor.executar(requisicoes, "CRACHA-7", assumir)).resolves.toBeNull();
    expect(assumir).toHaveBeenCalledOnce();

    liberarResposta?.(response(200, {}));
    await expect(primeira).resolves.toEqual([
      { numeroPedido: "REQ-1", tipo: "assumida" },
    ]);
  });
});
