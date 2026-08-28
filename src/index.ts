const PROTOCOL = "catalog3d:embed:v1" as const;
const DEFAULT_HOST = "https://catalog3d.ai";
const READY_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 10_000;
const REMOVAL_DESCRIPTION_MAX_LENGTH = 500;
const FONT_FAMILY_MAX_LENGTH = 200;
const SITE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/u;
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/u;
const ACCENT_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu;
const FONT_FAMILY_PATTERN = /^[\p{L}\p{N} "',._-]+$/u;
const LOCALES = new Set(["en", "de", "fr"] as const);
const THEMES = new Set(["auto", "dark", "light"] as const);

export type Catalog3DLocale = "en" | "de" | "fr";
export type Catalog3DTheme = "auto" | "dark" | "light";
export type Catalog3DErrorCode =
  | "FRAME_LOAD_FAILED"
  | "BUSY"
  | "INTERNAL_ERROR"
  | "INVALID_CONFIG"
  | "INVALID_REQUEST"
  | "ORIGIN_DENIED"
  | "PRODUCT_NOT_FOUND"
  | "ROOM_NOT_READY"
  | "SITE_NOT_FOUND"
  | "TARGET_IN_USE"
  | "TARGET_NOT_FOUND"
  | "TIMEOUT";

export type Catalog3DMountOptions = {
  target: Element | string;
  siteId: string;
  productId: string;
  variantId?: string;
  locale?: Catalog3DLocale;
  appearance?: {
    accentColor?: string;
    fontFamily?: string;
    theme?: Catalog3DTheme;
  };
};

export type Catalog3DRemovalRequest = {
  description: string;
};

export type Catalog3DHandle = {
  destroy(): void;
  requestRemoval(request: Catalog3DRemovalRequest): Promise<void>;
};

type PublicConfiguration = Readonly<{
  appearance: Readonly<{
    accentColor?: string;
    fontFamily?: string;
    theme: Catalog3DTheme;
  }>;
  locale: Catalog3DLocale;
  productId: string;
  siteId: string;
  variantId?: string;
}>;

type FrameMessage = {
  protocol: typeof PROTOCOL;
  instanceId: string;
  type:
    | "error"
    | "ready"
    | "removal-accepted"
    | "removal-rejected"
    | "room-ready";
  requestId?: string;
  error?: {
    code?: unknown;
    message?: unknown;
  };
};

const PUBLIC_ERROR_CODES = new Set<Catalog3DErrorCode>([
  "FRAME_LOAD_FAILED",
  "BUSY",
  "INTERNAL_ERROR",
  "INVALID_CONFIG",
  "INVALID_REQUEST",
  "ORIGIN_DENIED",
  "PRODUCT_NOT_FOUND",
  "ROOM_NOT_READY",
  "SITE_NOT_FOUND",
  "TARGET_IN_USE",
  "TARGET_NOT_FOUND",
  "TIMEOUT",
]);

export class Catalog3DError extends Error {
  readonly code: Catalog3DErrorCode;

  constructor(code: Catalog3DErrorCode, message: string) {
    super(message);
    this.name = "Catalog3DError";
    this.code = code;
  }
}

const trimValue = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const normalizeAccentColor = (value: unknown) => {
  const color = trimValue(value).toLowerCase();
  if (!color) return "";
  if (!ACCENT_COLOR_PATTERN.test(color)) {
    throw new Catalog3DError(
      "INVALID_CONFIG",
      "Catalog3D accentColor must be an opaque hex color.",
    );
  }
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return color;
};

const normalizeFontFamily = (value: unknown) => {
  const fontFamily = trimValue(value);
  if (!fontFamily) return "";
  if (
    fontFamily.length > FONT_FAMILY_MAX_LENGTH ||
    !FONT_FAMILY_PATTERN.test(fontFamily)
  ) {
    throw new Catalog3DError(
      "INVALID_CONFIG",
      "Catalog3D fontFamily is invalid.",
    );
  }
  return fontFamily;
};

const normalizeRemovalRequest = (value: Catalog3DRemovalRequest) => {
  const description = trimValue(value?.description);
  if (!description || description.length > REMOVAL_DESCRIPTION_MAX_LENGTH) {
    throw new Catalog3DError(
      "INVALID_REQUEST",
      "Catalog3D removal description must contain between 1 and 500 characters.",
    );
  }
  return Object.freeze({ description });
};

const makeInstanceId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `c3d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const getScriptHost = () => {
  if (typeof document === "undefined") return DEFAULT_HOST;
  const script = document.currentScript as HTMLScriptElement | null;
  const explicitHost = script?.dataset.catalog3dHost?.trim();
  const candidate = explicitHost || script?.src;
  if (!candidate) return DEFAULT_HOST;

  try {
    const url = new URL(candidate, location.href);
    const isLoopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
    if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) {
      return DEFAULT_HOST;
    }
    return url.origin;
  } catch {
    return DEFAULT_HOST;
  }
};

const sdkHost = getScriptHost();
const mountedTargets = new WeakMap<Element, Catalog3DHandle>();

const resolveTarget = (target: Element | string) => {
  if (typeof target !== "string") {
    return target instanceof Element ? target : null;
  }
  return document.querySelector(target);
};

const normalizeConfiguration = (
  options: Catalog3DMountOptions,
): PublicConfiguration => {
  const siteId = trimValue(options?.siteId);
  const productId = trimValue(options?.productId);
  const variantId = trimValue(options?.variantId);
  const locale = trimValue(options?.locale) || "en";
  const theme = trimValue(options?.appearance?.theme) || "auto";
  const accentColor = normalizeAccentColor(options?.appearance?.accentColor);
  const fontFamily = normalizeFontFamily(options?.appearance?.fontFamily);

  if (!SITE_ID_PATTERN.test(siteId)) {
    throw new Catalog3DError("INVALID_CONFIG", "Catalog3D siteId is invalid.");
  }
  if (!PRODUCT_ID_PATTERN.test(productId)) {
    throw new Catalog3DError("INVALID_CONFIG", "Catalog3D productId is invalid.");
  }
  if (variantId && !PRODUCT_ID_PATTERN.test(variantId)) {
    throw new Catalog3DError("INVALID_CONFIG", "Catalog3D variantId is invalid.");
  }
  if (!LOCALES.has(locale as Catalog3DLocale)) {
    throw new Catalog3DError("INVALID_CONFIG", "Catalog3D locale is unsupported.");
  }
  if (!THEMES.has(theme as Catalog3DTheme)) {
    throw new Catalog3DError("INVALID_CONFIG", "Catalog3D theme is unsupported.");
  }

  return Object.freeze({
    appearance: Object.freeze({
      theme: theme as Catalog3DTheme,
      ...(accentColor ? { accentColor } : {}),
      ...(fontFamily ? { fontFamily } : {}),
    }),
    locale: locale as Catalog3DLocale,
    productId,
    siteId,
    ...(variantId ? { variantId } : {}),
  });
};

const dispatchPublicEvent = (
  target: Element,
  type: "catalog3d:error" | "catalog3d:ready" | "catalog3d:room-ready",
  detail?: { code: Catalog3DErrorCode; message: string },
) => {
  target.dispatchEvent(new CustomEvent(type, { detail }));
};

const readFrameMessage = (value: unknown): FrameMessage | null => {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<FrameMessage>;
  if (
    candidate.protocol !== PROTOCOL ||
    typeof candidate.instanceId !== "string" ||
    ![
      "error",
      "ready",
      "removal-accepted",
      "removal-rejected",
      "room-ready",
    ].includes(candidate.type || "")
  ) {
    return null;
  }
  if (
    ["removal-accepted", "removal-rejected"].includes(candidate.type || "") &&
    (typeof candidate.requestId !== "string" ||
      !candidate.requestId ||
      candidate.requestId.length > 128)
  ) {
    return null;
  }
  return candidate as FrameMessage;
};

const toPublicError = (message: FrameMessage) => {
  const candidateCode = message.error?.code;
  const code =
    typeof candidateCode === "string" &&
    PUBLIC_ERROR_CODES.has(candidateCode as Catalog3DErrorCode)
      ? (candidateCode as Catalog3DErrorCode)
      : "INTERNAL_ERROR";
  const candidateMessage = message.error?.message;
  const safeMessage =
    typeof candidateMessage === "string" && candidateMessage.length <= 240
      ? candidateMessage
      : "Catalog3D is temporarily unavailable.";
  return new Catalog3DError(code, safeMessage);
};

export const version = "1.2.0" as const;

export function mount(options: Catalog3DMountOptions): Promise<Catalog3DHandle> {
  let target: Element | null = null;
  let configuration: PublicConfiguration;
  try {
    target = resolveTarget(options?.target);
    if (!target) {
      throw new Catalog3DError("TARGET_NOT_FOUND", "Catalog3D target was not found.");
    }
    if (mountedTargets.has(target)) {
      throw new Catalog3DError("TARGET_IN_USE", "Catalog3D is already mounted here.");
    }
    configuration = normalizeConfiguration(options);
  } catch (error) {
    const publicError =
      error instanceof Catalog3DError
        ? error
        : new Catalog3DError("INVALID_CONFIG", "Catalog3D configuration is invalid.");
    if (target) {
      dispatchPublicEvent(target, "catalog3d:error", {
        code: publicError.code,
        message: publicError.message,
      });
    }
    return Promise.reject(publicError);
  }

  const instanceId = makeInstanceId();
  const frame = document.createElement("iframe");
  const frameUrl = new URL("/embed/room", sdkHost);
  const wrapper = document.createElement("div");
  let destroyed = false;
  let ready = false;
  let readyTimeout = 0;
  let requestSequence = 0;
  let rejectReady: (error: Catalog3DError) => void = () => undefined;
  let resolveReady: (handle: Catalog3DHandle) => void = () => undefined;
  const pendingRequests = new Map<string, {
    reject: (error: Catalog3DError) => void;
    resolve: () => void;
    timeout: number;
  }>();

  wrapper.dataset.catalog3dEmbed = "v1";
  wrapper.style.cssText =
    "display:block;inline-size:100%;block-size:100%;min-block-size:420px;overflow:hidden;";
  frame.src = frameUrl.toString();
  frame.title = "Catalog3D room preview";
  frame.loading = "eager";
  frame.referrerPolicy = "no-referrer";
  frame.setAttribute(
    "sandbox",
    "allow-downloads allow-forms allow-same-origin allow-scripts",
  );
  frame.style.cssText =
    "display:block;border:0;inline-size:100%;block-size:100%;min-block-size:420px;";
  wrapper.appendChild(frame);
  target.replaceChildren(wrapper);

  const cleanup = (removeDom: boolean) => {
    if (!destroyed) {
      destroyed = true;
      window.clearTimeout(readyTimeout);
      window.removeEventListener("message", handleMessage);
      frame.removeEventListener("load", handleLoad);
      frame.removeEventListener("error", handleFrameError);
      mountedTargets.delete(target!);
      const closedError = new Catalog3DError(
        "INTERNAL_ERROR",
        "Catalog3D closed before the request was accepted.",
      );
      pendingRequests.forEach((pending) => {
        window.clearTimeout(pending.timeout);
        pending.reject(closedError);
      });
      pendingRequests.clear();
    }
    if (removeDom) wrapper.remove();
  };

  const handle: Catalog3DHandle = Object.freeze({
    destroy() {
      cleanup(true);
    },
    requestRemoval(request) {
      let normalizedRequest: Readonly<Catalog3DRemovalRequest>;
      try {
        if (destroyed || !ready || !frame.contentWindow) {
          throw new Catalog3DError(
            "INTERNAL_ERROR",
            "Catalog3D is not available for removal requests.",
          );
        }
        normalizedRequest = normalizeRemovalRequest(request);
      } catch (error) {
        const publicError = error instanceof Catalog3DError
          ? error
          : new Catalog3DError("INVALID_REQUEST", "Catalog3D removal request is invalid.");
        dispatchPublicEvent(target!, "catalog3d:error", {
          code: publicError.code,
          message: publicError.message,
        });
        return Promise.reject(publicError);
      }

      const requestId = `${instanceId}:removal:${++requestSequence}`;
      return new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          pendingRequests.delete(requestId);
          const error = new Catalog3DError(
            "TIMEOUT",
            "Catalog3D took too long to accept the removal request.",
          );
          dispatchPublicEvent(target!, "catalog3d:error", {
            code: error.code,
            message: error.message,
          });
          reject(error);
        }, REQUEST_TIMEOUT_MS);
        pendingRequests.set(requestId, { reject, resolve, timeout });
        frame.contentWindow!.postMessage(
          {
            protocol: PROTOCOL,
            type: "removal-request",
            instanceId,
            requestId,
            description: normalizedRequest.description,
          },
          sdkHost,
        );
      });
    },
  });
  mountedTargets.set(target, handle);

  const fail = (error: Catalog3DError, removeDom: boolean) => {
    dispatchPublicEvent(target!, "catalog3d:error", {
      code: error.code,
      message: error.message,
    });
    if (!ready) rejectReady(error);
    cleanup(removeDom);
  };

  function handleLoad() {
    if (destroyed || !frame.contentWindow) return;
    frame.contentWindow.postMessage(
      {
        protocol: PROTOCOL,
        type: "init",
        instanceId,
        configuration,
      },
      sdkHost,
    );
  }

  function handleFrameError() {
    fail(
      new Catalog3DError(
        "FRAME_LOAD_FAILED",
        "Catalog3D could not load the room experience.",
      ),
      true,
    );
  }

  function handleMessage(event: MessageEvent) {
    if (
      destroyed ||
      event.origin !== sdkHost ||
      event.source !== frame.contentWindow
    ) {
      return;
    }
    const message = readFrameMessage(event.data);
    if (!message || message.instanceId !== instanceId) return;

    if (message.type === "ready") {
      if (ready) return;
      ready = true;
      window.clearTimeout(readyTimeout);
      dispatchPublicEvent(target!, "catalog3d:ready");
      resolveReady(handle);
      return;
    }
    if (message.type === "room-ready") {
      if (ready) dispatchPublicEvent(target!, "catalog3d:room-ready");
      return;
    }
    if (
      message.type === "removal-accepted" ||
      message.type === "removal-rejected"
    ) {
      if (!ready || !message.requestId) return;
      const pending = pendingRequests.get(message.requestId);
      if (!pending) return;
      pendingRequests.delete(message.requestId);
      window.clearTimeout(pending.timeout);
      if (message.type === "removal-accepted") {
        pending.resolve();
        return;
      }
      const error = toPublicError(message);
      dispatchPublicEvent(target!, "catalog3d:error", {
        code: error.code,
        message: error.message,
      });
      pending.reject(error);
      return;
    }
    fail(toPublicError(message), false);
  }

  window.addEventListener("message", handleMessage);
  frame.addEventListener("load", handleLoad);
  frame.addEventListener("error", handleFrameError);

  const readyPromise = new Promise<Catalog3DHandle>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
    readyTimeout = window.setTimeout(() => {
      fail(
        new Catalog3DError("TIMEOUT", "Catalog3D took too long to become ready."),
        true,
      );
    }, READY_TIMEOUT_MS);
  });
  return readyPromise;
}

class Catalog3DRoomElement extends HTMLElement {
  #handle: Catalog3DHandle | null = null;
  #generation = 0;

  connectedCallback() {
    if (this.#handle || this.childElementCount > 0) return;
    const generation = ++this.#generation;
    if (!this.style.display) this.style.display = "block";
    if (!this.style.minHeight) this.style.minHeight = "420px";

    void mount({
      target: this,
      siteId: this.getAttribute("site-id") || "",
      productId: this.getAttribute("product-id") || "",
      ...(this.getAttribute("variant-id")
        ? { variantId: this.getAttribute("variant-id") || undefined }
        : {}),
      ...(this.getAttribute("locale")
        ? { locale: this.getAttribute("locale") as Catalog3DLocale }
        : {}),
      appearance: {
        theme: (this.getAttribute("theme") || "auto") as Catalog3DTheme,
        ...(this.getAttribute("accent-color")
          ? { accentColor: this.getAttribute("accent-color") || undefined }
          : {}),
        ...(this.getAttribute("font-family")
          ? { fontFamily: this.getAttribute("font-family") || undefined }
          : {}),
      },
    })
      .then((handle) => {
        if (!this.isConnected || generation !== this.#generation) {
          handle.destroy();
          return;
        }
        this.#handle = handle;
      })
      .catch(() => undefined);
  }

  disconnectedCallback() {
    this.#generation += 1;
    this.#handle?.destroy();
    this.#handle = null;
  }
}

if (
  typeof customElements !== "undefined" &&
  !customElements.get("catalog3d-room")
) {
  customElements.define("catalog3d-room", Catalog3DRoomElement);
}
