import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  states: [] as unknown[],
  stateOverrides: {} as Record<number, unknown>,
  stateIndex: 0,
  refs: [] as Array<{ current: unknown }>,
  refIndex: 0,
  effects: [] as Array<() => void | (() => void)>,
  video: null as null | { srcObject: unknown; play: () => Promise<void> },
  decodeCallbacks: [] as Array<(result: { rawValue: string; format: string }) => Promise<void>>,
  scannerStops: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const stateIndex = runtime.stateIndex++;
      const store = runtime.states;
      if (!(stateIndex in store)) {
        store[stateIndex] = stateIndex in runtime.stateOverrides
          ? runtime.stateOverrides[stateIndex]
          : typeof initial === "function"
            ? (initial as () => unknown)()
            : initial;
      }
      return [
        store[stateIndex],
        (next: unknown) => {
          store[stateIndex] = typeof next === "function"
            ? (next as (current: unknown) => unknown)(store[stateIndex])
            : next;
        },
      ];
    },
    useRef: (initial: unknown) => {
      const refIndex = runtime.refIndex++;
      runtime.refs[refIndex] ??= {
        current: refIndex === 0 && runtime.video ? runtime.video : initial,
      };
      return runtime.refs[refIndex];
    },
    useEffect: (effect: () => void | (() => void)) => runtime.effects.push(effect),
    useMemo: (factory: () => unknown) => factory(),
    useCallback: (callback: unknown) => callback,
  };
});

vi.mock("next/navigation", () => ({
  useParams: () => ({ numeroPedido: "REQ-1" }),
}));

vi.mock("../../../../lib/qr/decoder", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../lib/qr/decoder")>();
  return {
    ...actual,
    createScanner: vi.fn((_video: unknown, options: {
      onDecode: (result: { rawValue: string; format: string }) => Promise<void>;
    }) => {
      runtime.decodeCallbacks.push(options.onDecode);
      const stop = vi.fn();
      runtime.scannerStops.push(stop);
      return { start: vi.fn(async () => undefined), stop };
    }),
  };
});

import ProductEtiquetaScanner from "../../../components/ProductEtiquetaScanner";
import ChecklistRequisicaoPage from "./page";

const requestItem = {
  id: "request-item-1",
  itemId: "product-1",
  nome: "Arruela",
  categoria: "Fixadores",
  descricao: "Montagem",
  codigo: "129",
  unidadeMedida: "UN",
  quantidadeSolicitada: 2,
  status: "ASSUMIDO",
  conferido: false,
};

function findElement(node: unknown, type: unknown): { type: unknown; props: Record<string, unknown> } | null {
  if (!node || typeof node !== "object") return null;
  const element = node as { type?: unknown; props?: Record<string, unknown> };
  if (element.type === type) return element as { type: unknown; props: Record<string, unknown> };
  const children = element.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findElement(child, type);
      if (found) return found;
    }
  } else {
    return findElement(children, type);
  }
  return null;
}

async function flushPromises() {
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
}

function createMediaStream() {
  const trackStops = [vi.fn(), vi.fn()];
  const videoTrack = {
    stop: trackStops[0],
    getCapabilities: vi.fn(() => ({})),
    applyConstraints: vi.fn(async () => undefined),
  };
  const otherTrack = { stop: trackStops[1] };
  const stream = {
    getTracks: () => [videoTrack, otherTrack],
    getVideoTracks: () => [videoTrack],
  };
  return { stream, trackStops };
}

function resetRenderState(request: object) {
  runtime.states = [];
  runtime.stateOverrides = {
    0: request,
    6: false,
    7: true,
  };
  runtime.stateIndex = 0;
  runtime.refs = [];
  runtime.refIndex = 0;
  runtime.effects = [];
}

function getScannerProps() {
  runtime.stateIndex = 0;
  const tree = ChecklistRequisicaoPage();
  const scannerElement = findElement(tree, ProductEtiquetaScanner);
  expect(scannerElement).not.toBeNull();
  return scannerElement!.props as {
    onRead: (raw: string, format: string) => Promise<{ message: string; success: boolean }>;
    onClose: () => void;
  };
}

function mountScanner(props: ReturnType<typeof getScannerProps>) {
  runtime.states = [];
  runtime.stateOverrides = {};
  runtime.stateIndex = 0;
  runtime.refs = [];
  runtime.refIndex = 0;
  runtime.effects = [];
  const readResults: unknown[] = [];
  const scannerProps = {
    ...props,
    onRead: async (raw: string, format: string) => {
      const result = await props.onRead(raw, format);
      readResults.push(result);
      return result;
    },
  };
  ProductEtiquetaScanner(scannerProps);
  const cleanup = runtime.effects.map((effect) => effect()).filter(
    (value): value is () => void => typeof value === "function",
  );
  return { cleanup, readResults };
}

describe("checklist QR scanner integration", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    runtime.decodeCallbacks = [];
    runtime.scannerStops = [];
    runtime.video = { srcObject: null, play: vi.fn(async () => undefined) };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("checks a valid item once and closes the real checklist scanner after success feedback", async () => {
    const { stream, trackStops } = createMediaStream();
    const pageState = {
      numeroPedido: "REQ-1",
      status: "ASSUMIDA",
      prioridade: "PADRAO",
      criadoEm: "2026-10-06T12:00:00Z",
      solicitante: "Operador",
      atendente: "Almoxarife",
      podeFinalizar: true,
      itens: [requestItem],
    };
    resetRenderState(pageState);
    vi.stubGlobal("document", {
      documentElement: { dataset: {} },
      getElementById: () => null,
    });
    vi.stubGlobal("window", {
      isSecureContext: true,
      location: { hostname: "localhost", search: "" },
      dispatchEvent: vi.fn(),
      requestAnimationFrame: vi.fn(),
      setTimeout,
      clearTimeout,
    });
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn(async () => stream) },
      vibrate: vi.fn(),
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        message: "Item conferido. Informe a quantidade real.",
        itemId: requestItem.id,
        jaConferido: false,
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const props = getScannerProps();
    const pageStates = runtime.states;
    const { cleanup, readResults } = mountScanner(props);
    await flushPromises();

    const firstRead = runtime.decodeCallbacks[0]({ rawValue: "129", format: "qr_code" });
    const duplicateRead = runtime.decodeCallbacks[0]({ rawValue: "129", format: "qr_code" });
    await Promise.all([firstRead, duplicateRead]);
    expect(readResults[0]).toEqual({
      message: "Item conferido. Informe a quantidade real.",
      success: true,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect((pageStates[0] as typeof pageState).itens[0].conferido).toBe(true);
    expect(pageStates[7]).toBe(true);

    vi.advanceTimersByTime(649);
    expect(pageStates[7]).toBe(true);
    vi.advanceTimersByTime(1);
    expect(trackStops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
    expect(runtime.scannerStops[0]).toHaveBeenCalledOnce();
    expect(runtime.video?.srcObject).toBeNull();
    expect(pageStates[7]).toBe(false);
    expect((document.documentElement as HTMLElement).dataset.qrScannerActive).toBeUndefined();
    cleanup.forEach((dispose) => dispose());
  });

  it("keeps the real checklist camera open when the scanned product is not in the request", async () => {
    const { stream, trackStops } = createMediaStream();
    resetRenderState({
      numeroPedido: "REQ-1",
      status: "ASSUMIDA",
      prioridade: "PADRAO",
      criadoEm: "2026-10-06T12:00:00Z",
      solicitante: "Operador",
      atendente: "Almoxarife",
      podeFinalizar: true,
      itens: [requestItem],
    });
    vi.stubGlobal("document", { documentElement: { dataset: {} }, getElementById: () => null });
    vi.stubGlobal("window", {
      isSecureContext: true,
      location: { hostname: "localhost", search: "" },
      dispatchEvent: vi.fn(),
      requestAnimationFrame: vi.fn(),
      setTimeout,
      clearTimeout,
    });
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn(async () => stream) },
      vibrate: vi.fn(),
    });
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({
        error: "Este item não está nesta requisição.",
        produto: { codigo: "130", nome: "Outro produto" },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const props = getScannerProps();
    const pageStates = runtime.states;
    const { cleanup } = mountScanner(props);
    await flushPromises();
    await runtime.decodeCallbacks[0]({ rawValue: "130", format: "qr_code" });
    await runtime.decodeCallbacks[0]({ rawValue: "texto sem formato de etiqueta", format: "qr_code" });

    vi.advanceTimersByTime(1300);
    expect(pageStates[7]).toBe(true);
    expect((pageStates[0] as { itens: Array<{ conferido: boolean }> }).itens[0].conferido).toBe(false);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(trackStops.every((stop) => stop.mock.calls.length === 0)).toBe(true);
    cleanup.forEach((dispose) => dispose());
    expect(trackStops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
  });

  it("opens a fresh stream and reads again after an automatic close", async () => {
    const firstStream = createMediaStream();
    const nextStream = createMediaStream();
    const getUserMedia = vi.fn()
      .mockResolvedValueOnce(firstStream.stream)
      .mockResolvedValueOnce(nextStream.stream);
    resetRenderState({
      numeroPedido: "REQ-1",
      status: "ASSUMIDA",
      prioridade: "PADRAO",
      criadoEm: "2026-10-06T12:00:00Z",
      solicitante: "Operador",
      atendente: "Almoxarife",
      podeFinalizar: true,
      itens: [requestItem],
    });
    vi.stubGlobal("document", { documentElement: { dataset: {} }, getElementById: () => null });
    vi.stubGlobal("window", {
      isSecureContext: true,
      location: { hostname: "localhost", search: "" },
      dispatchEvent: vi.fn(),
      requestAnimationFrame: vi.fn(),
      setTimeout,
      clearTimeout,
    });
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia },
      vibrate: vi.fn(),
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        message: "Item conferido. Informe a quantidade real.",
        itemId: requestItem.id,
        jaConferido: false,
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const firstProps = getScannerProps();
    const pageStates = runtime.states;
    const firstMount = mountScanner(firstProps);
    await flushPromises();
    await runtime.decodeCallbacks[0]({ rawValue: "129", format: "qr_code" });
    vi.advanceTimersByTime(650);
    firstMount.cleanup.forEach((dispose) => dispose());
    expect(firstStream.trackStops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
    expect(pageStates[7]).toBe(false);

    runtime.states = pageStates;
    pageStates[7] = true;
    runtime.stateIndex = 0;
    runtime.refs = [];
    runtime.refIndex = 0;
    runtime.effects = [];
    runtime.video = { srcObject: null, play: vi.fn(async () => undefined) };
    const secondProps = getScannerProps();
    const secondMount = mountScanner(secondProps);
    await flushPromises();

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(runtime.decodeCallbacks).toHaveLength(2);
    expect(runtime.video?.srcObject).toBe(nextStream.stream);
    await runtime.decodeCallbacks[1]({ rawValue: "129", format: "qr_code" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    secondMount.cleanup.forEach((dispose) => dispose());
    expect(nextStream.trackStops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
  });
});
