import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtime = vi.hoisted(() => ({
  states: [] as unknown[],
  stateOverrides: {} as Record<number, unknown>,
  stateIndex: 0,
  refs: [] as Array<{ current: unknown }>,
  refIndex: 0,
  effects: [] as Array<() => void | (() => void)>,
  video: null as null | { srcObject: unknown; play: () => Promise<void>; pause: () => void; removeAttribute: (name: string) => void },
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
import PriorityBadge from "../../../components/PriorityBadge";
import ItemDescription from "../../../components/ItemDescription";
import ProductCode from "../../../components/ProductCode";
import ChecklistRequisicaoPage from "./page";
import type { ScannerReadResult } from "../../../../lib/qr/camera-utils";

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

function nodeText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join("");
  if (!node || typeof node !== "object") return "";
  return nodeText((node as { props?: { children?: unknown } }).props?.children);
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
    7: false,
    8: true,
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
    onRead: (raw: string, format: string) => Promise<ScannerReadResult>;
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
    runtime.video = {
      srcObject: null,
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      removeAttribute: vi.fn(),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("shows the product code prominently while retaining the description and priority badge", () => {
    resetRenderState({
      numeroPedido: "REQ-1",
      status: "ASSUMIDA",
      prioridade: "PRIORITARIO",
      criadoEm: "2026-10-06T12:00:00Z",
      solicitante: "Operador",
      atendente: "Almoxarife",
      podeFinalizar: true,
      itens: [{ ...requestItem, descricao: "Montagem na linha" }],
    });

    const tree = ChecklistRequisicaoPage();

    expect(findElement(tree, ProductCode)?.props.code).toBe("129");
    expect(findElement(tree, ItemDescription)?.props.descricao).toBe("Montagem na linha");
    expect(findElement(tree, PriorityBadge)?.props.priority).toBe("prioridade");
    expect(nodeText(findElement(tree, "h1")?.props.children)).toContain("Checklist de separação");
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

    await runtime.decodeCallbacks[0]({ rawValue: "129", format: "qr_code" });
    vi.advanceTimersByTime(50);
    await runtime.decodeCallbacks[0]({ rawValue: "129", format: "qr_code" });
    vi.advanceTimersByTime(50);
    await runtime.decodeCallbacks[0]({ rawValue: "129", format: "qr_code" });
    vi.advanceTimersByTime(50);
    await runtime.decodeCallbacks[0]({ rawValue: "130", format: "qr_code" });
    expect(readResults[0]).toEqual({
      message: "Item conferido. Informe a quantidade real.",
      kind: "confirmed",
    });
    expect(readResults).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect((pageStates[0] as typeof pageState).itens[0].conferido).toBe(true);
    expect(pageStates[8]).toBe(true);

    vi.advanceTimersByTime(499);
    expect(pageStates[8]).toBe(true);
    vi.advanceTimersByTime(1);
    expect(trackStops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
    expect(runtime.scannerStops[0]).toHaveBeenCalledOnce();
    expect(runtime.video?.srcObject).toBeNull();
    expect(pageStates[8]).toBe(false);
    expect((document.documentElement as HTMLElement).dataset.qrScannerActive).toBeUndefined();
    cleanup.forEach((dispose) => dispose());
  });

  it("cancels the feedback timer and stops tracks without state updates when unmounted", async () => {
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
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({
        message: "Item conferido. Informe a quantidade real.",
        itemId: requestItem.id,
        jaConferido: false,
      }),
    })));
    const props = getScannerProps();
    const pageStates = runtime.states;
    const { cleanup } = mountScanner(props);
    await flushPromises();
    await runtime.decodeCallbacks[0]({ rawValue: "129", format: "qr_code" });
    const cameraStateBeforeUnmount = runtime.states[7];

    cleanup.forEach((dispose) => dispose());
    vi.advanceTimersByTime(650);

    expect(trackStops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
    expect(runtime.video?.srcObject).toBeNull();
    expect(runtime.states[7]).toBe(cameraStateBeforeUnmount);
    expect(pageStates[8]).toBe(true);
    expect((document.documentElement as HTMLElement).dataset.qrScannerActive).toBeUndefined();
  });

  it("keeps the second checklist camera stream alive across a StrictMode-style remount", async () => {
    const lateFirstStream = createMediaStream();
    const activeSecondStream = createMediaStream();
    let resolveFirstStream!: (stream: MediaStream) => void;
    const getUserMedia = vi.fn()
      .mockImplementationOnce(() => new Promise<MediaStream>((resolve) => { resolveFirstStream = resolve; }))
      .mockResolvedValueOnce(activeSecondStream.stream);
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
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia }, vibrate: vi.fn() });
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));

    const firstProps = getScannerProps();
    const pageStates = runtime.states;
    const firstMount = mountScanner(firstProps);
    await flushPromises();
    expect(getUserMedia).toHaveBeenCalledOnce();
    firstMount.cleanup.forEach((dispose) => dispose());

    runtime.states = pageStates;
    pageStates[8] = true;
    runtime.stateIndex = 0;
    runtime.refs = [];
    runtime.refIndex = 0;
    runtime.effects = [];
    runtime.video = {
      srcObject: null,
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      removeAttribute: vi.fn(),
    };
    const secondProps = getScannerProps();
    const secondMount = mountScanner(secondProps);
    await flushPromises();
    expect(runtime.video?.srcObject).toBe(activeSecondStream.stream);

    resolveFirstStream(lateFirstStream.stream as unknown as MediaStream);
    await flushPromises();
    expect(lateFirstStream.trackStops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
    expect(activeSecondStream.trackStops.every((stop) => stop.mock.calls.length === 0)).toBe(true);
    expect(runtime.video?.srcObject).toBe(activeSecondStream.stream);

    secondMount.cleanup.forEach((dispose) => dispose());
    expect(activeSecondStream.trackStops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
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
    expect(pageStates[8]).toBe(true);
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
    expect(pageStates[8]).toBe(false);

    runtime.states = pageStates;
    pageStates[8] = true;
    runtime.stateIndex = 0;
    runtime.refs = [];
    runtime.refIndex = 0;
    runtime.effects = [];
    runtime.video = {
      srcObject: null,
      play: vi.fn(async () => undefined),
      pause: vi.fn(),
      removeAttribute: vi.fn(),
    };
    const secondProps = getScannerProps();
    const secondMount = mountScanner(secondProps);
    await flushPromises();

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(runtime.decodeCallbacks).toHaveLength(2);
    expect(runtime.video?.srcObject).toBe(nextStream.stream);
    await runtime.decodeCallbacks[1]({ rawValue: "129", format: "qr_code" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(secondMount.readResults[0]).toMatchObject({ kind: "already-confirmed" });
    vi.advanceTimersByTime(649);
    expect(pageStates[8]).toBe(true);
    vi.advanceTimersByTime(1);
    expect(pageStates[8]).toBe(false);
    secondMount.cleanup.forEach((dispose) => dispose());
    expect(nextStream.trackStops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
  });

  it("reports an item checked before this scanner session without calling the check endpoint", async () => {
    const { stream, trackStops } = createMediaStream();
    resetRenderState({
      numeroPedido: "REQ-1",
      status: "ASSUMIDA",
      prioridade: "PADRAO",
      criadoEm: "2026-10-06T12:00:00Z",
      solicitante: "Operador",
      atendente: "Almoxarife",
      podeFinalizar: true,
      itens: [{ ...requestItem, conferido: true }],
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
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const props = getScannerProps();
    const pageStates = runtime.states;
    const { cleanup, readResults } = mountScanner(props);
    await flushPromises();

    await runtime.decodeCallbacks[0]({ rawValue: "129", format: "qr_code" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(readResults[0]).toMatchObject({
      kind: "already-confirmed",
      message: "Esse item já foi conferido",
    });
    vi.advanceTimersByTime(649);
    expect(pageStates[8]).toBe(true);
    vi.advanceTimersByTime(1);
    expect(trackStops.every((stop) => stop.mock.calls.length === 1)).toBe(true);
    expect(runtime.video?.srcObject).toBeNull();
    expect(pageStates[8]).toBe(false);
    expect((document.documentElement as HTMLElement).dataset.qrScannerActive).toBeUndefined();
    cleanup.forEach((dispose) => dispose());
  });

  it("uses the same no-write informational outcome for a typed code and closes an open scanner", async () => {
    resetRenderState({
      numeroPedido: "REQ-1",
      status: "ASSUMIDA",
      prioridade: "PADRAO",
      criadoEm: "2026-10-06T12:00:00Z",
      solicitante: "Operador",
      atendente: "Almoxarife",
      podeFinalizar: true,
      itens: [{ ...requestItem, conferido: true }],
    });
    runtime.stateOverrides[3] = "129";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const tree = ChecklistRequisicaoPage();
    const form = findElement(tree, "form");
    expect(form).not.toBeNull();
    const submit = form!.props.onSubmit as (event: { preventDefault(): void }) => Promise<void>;

    await submit({ preventDefault: vi.fn() });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(runtime.states[4]).toBe("Esse item já foi conferido");
    expect(runtime.states[5]).toBe("already-confirmed");
    expect(runtime.states[8]).toBe(false);
  });
});
