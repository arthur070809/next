"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import type { RequisicaoMock } from "../../lib/types/almoxarifado";
import { startVisibilityPolling } from "../../lib/visibility-polling";
import type { PlanoViagens } from "../../lib/viagem/planejar-viagens";
import {
  carregarPlanoViagem,
  consultarDadosReais,
  planoViagemDemonstracao,
  viagemDemoDisponivel,
} from "../../lib/viagem/demo-mode";
import {
  ExecutorAssuncaoLote,
  type ResultadoAssuncaoLote,
} from "../../lib/viagem/assumir-lote";

const podeAtivarDemonstracao = viagemDemoDisponivel(
  process.env.NODE_ENV,
  process.env.NEXT_PUBLIC_VIAGEM_DEMO,
);

function formatarIdade(data: string) {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 60000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  return `${Math.floor(horas / 24)} d`;
}

export default function RequisicoesQueuePage() {
  const router = useRouter();
  const [requisicoes, setRequisicoes] = useState<RequisicaoMock[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atualizacao, setAtualizacao] = useState(0);
  const [requisicaoParaAssumir, setRequisicaoParaAssumir] = useState<RequisicaoMock | null>(null);
  const [viagemParaAssumir, setViagemParaAssumir] = useState<RequisicaoMock[] | null>(null);
  const [assumindo, setAssumindo] = useState(false);
  const [assumindoLote, setAssumindoLote] = useState(false);
  const [resultadosLote, setResultadosLote] = useState<ResultadoAssuncaoLote[]>([]);
  const [erroAcao, setErroAcao] = useState("");
  const [mostrarViagens, setMostrarViagens] = useState(false);
  const [modoDemonstracao, setModoDemonstracao] = useState(false);
  const [planoViagens, setPlanoViagens] = useState<PlanoViagens | null>(null);
  const [carregandoViagens, setCarregandoViagens] = useState(false);
  const [erroViagens, setErroViagens] = useState("");
  const carregado = useRef(false);
  const executorAssuncaoLote = useRef(new ExecutorAssuncaoLote());
  const planoViagensExibido = modoDemonstracao ? planoViagemDemonstracao : planoViagens;

  useEffect(() => {
    let active = true;
    let loadingRequests = false;
    let requestController: AbortController | null = null;
    const loadRequests = () => {
      if (!active || document.visibilityState === "hidden" || loadingRequests) return;
      loadingRequests = true;
      if (!modoDemonstracao && !carregado.current) setCarregando(true);
      void consultarDadosReais(modoDemonstracao, async () => {
        requestController = new AbortController();
        const response = await fetch("/api/almoxarifado/requisicoes", {
          cache: "no-store",
          signal: requestController.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Não foi possível carregar as requisições.");
        return data.requisicoes as RequisicaoMock[];
      }).then((rows) => {
        if (active && rows) {
          setRequisicoes(rows);
          setErro("");
        }
      }).catch((cause) => {
        if (active) setErro(cause instanceof Error ? cause.message : "Não foi possível carregar as requisições.");
      }).finally(() => {
        if (active) {
          if (!modoDemonstracao) carregado.current = true;
          setCarregando(false);
        }
        requestController = null;
        loadingRequests = false;
      });
    };
    const stopPolling = startVisibilityPolling(document, loadRequests, 10000);
    loadRequests();
    return () => {
      active = false;
      requestController?.abort();
      stopPolling();
    };
  }, [atualizacao, modoDemonstracao]);

  useEffect(() => {
    if (!mostrarViagens) return;
    if (modoDemonstracao) return;

    let active = true;
    let loading = false;
    let requestController: AbortController | null = null;
    const carregarViagens = async () => {
      if (!active || document.visibilityState === "hidden" || loading) return;
      loading = true;
      setCarregandoViagens(true);
      try {
        const data = await carregarPlanoViagem(modoDemonstracao, async () => {
          requestController = new AbortController();
          const response = await fetch("/api/almoxarifado/viagens", {
            cache: "no-store",
            signal: requestController.signal,
          });
          const resultado = await response.json() as PlanoViagens & { error?: string };
          if (!response.ok) {
            throw new Error(resultado.error ?? "Não foi possível montar as viagens.");
          }
          return resultado;
        });
        if (active) {
          setPlanoViagens(data);
          setErroViagens("");
        }
      } catch (cause) {
        if (active) {
          setErroViagens(
            cause instanceof Error
              ? cause.message
              : "Não foi possível montar as viagens.",
          );
        }
      } finally {
        loading = false;
        requestController = null;
        if (active) setCarregandoViagens(false);
      }
    };

    const stopPolling = startVisibilityPolling(
      document,
      () => void carregarViagens(),
      10000,
    );
    void carregarViagens();
    return () => {
      active = false;
      requestController?.abort();
      stopPolling();
    };
  }, [mostrarViagens, modoDemonstracao]);

  const filtradas = useMemo(() => requisicoes.filter((request) =>
    `${request.numeroPedido} ${request.item} ${request.solicitante ?? ""}`.toLowerCase().includes(busca.toLowerCase())
  ), [requisicoes, busca]);


}