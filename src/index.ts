const PROTOCOL = "catalog3d:embed:v1" as const;
const DEFAULT_HOST = "https://catalog3d.ai";
const INIT_RETRY_MS = 500;
const READY_TIMEOUT_MS = 20_000;
const REQUEST_TIMEOUT_MS = 10_000;
const REMOVAL_DESCRIPTION_MAX_LENGTH = 500;
const FONT_FAMILY_MAX_LENGTH = 200;
const SITE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/u;
const PRODUCT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/u;
const ACCENT_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu;
const FONT_FAMILY_PATTERN = /^[\p{L}\p{N} "',._-]+$/u;
const OPTION_NAME_PATTERN = /^[A-Za-z0-9_$]{1,40}$/u;
const LOCALES = new Set(["en", "de", "fr"] as const);
const THEMES = new Set(["auto", "dark", "light"] as const);
const MOUNT_OPTION_NAMES = new Set([
  "appearance",
  "locale",
  "productId",
  "siteId",
  "target",
  "variantId",
]);
const APPEARANCE_OPTION_NAMES = new Set(["accentColor", "fontFamily", "theme"]);

// The host page owns the surrounding document, so every loader-owned box is
// declared `!important`. Inline `!important` outranks author `!important`, which
// keeps a merchant's global reset (`iframe { width: auto }`, `* { margin: 8px }`)
// from collapsing the embed. Merchants size the target element instead.
const BOX_STYLE = [
  "display:block !important",
  "box-sizing:border-box !important",
  "margin:0 !important",
  "padding:0 !important",
  "border:0 !important",
  "float:none !important",
  "inline-size:100% !important",
  "block-size:100% !important",
  "min-inline-size:0 !important",
  "min-block-size:420px !important",
  "max-inline-size:none !important",
  "max-block-size:none !important",
].join(";");
const WRAPPER_STYLE = `${BOX_STYLE};position:relative !important;overflow:hidden !important;`;
const FRAME_STYLE = `${BOX_STYLE};position:static !important;background:transparent !important;`;

// Delegated Permissions Policy features. A cross-origin frame is denied these by
// default, and only the embedding page can grant them, so the loader delegates
// exactly what the room experience needs: camera for in-frame room capture,
// device sensors and WebXR for placement, and fullscreen for the expanded view.
// Each is delegated to the frame's own origin only, and the browser still
// prompts the shopper before the camera is used.
const FRAME_PERMISSIONS = [
  "accelerometer",
  "camera",
  "fullscreen",
  "gyroscope",
  "magnetometer",
  "xr-spatial-tracking",
].join("; ");

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

// The iframe title is announced by the host page's screen reader, so it follows
// the public `locale` instead of staying English on a German or French store.
const FRAME_TITLES: Readonly<Record<Catalog3DLocale, string>> = Object.freeze({
  de: "Catalog3D Raumvorschau",
  en: "Catalog3D room preview",
  fr: "Aperçu de la pièce Catalog3D",
});

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

// Unknown keys are rejected rather than ignored. On a third-party embed a typo
// (`local: "de"`, `accentcolor`) would otherwise mount silently with the wrong
// configuration, which is far harder for a merchant to diagnose than a thrown
// INVALID_CONFIG at integration time.
const assertKnownOptions = (
  value: unknown,
  allowed: ReadonlySet<string>,
  label: string,
) => {
  if (value === undefined || value === null) return;
  if (typeof value !== "object") {
    throw new Catalog3DError(
      "INVALID_CONFIG",
      `Catalog3D ${label} must be an object.`,
    );
  }
  const unknown = Object.keys(value).filter((name) => !allowed.has(name));
  if (unknown.length === 0) return;
  const named = unknown.filter((name) => OPTION_NAME_PATTERN.test(name)).slice(0, 5);
  throw new Catalog3DError(
    "INVALID_CONFIG",
    named.length > 0
      ? `Catalog3D ${label} has unsupported options: ${named.join(", ")}.`
      : `Catalog3D ${label} has unsupported options.`,
  );
};

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
  try {
    return document.querySelector(target);
  } catch {
    // An invalid selector is a target problem, not a configuration problem.
    return null;
  }
};

const normalizeConfiguration = (
  options: Catalog3DMountOptions,
): PublicConfiguration => {
  assertKnownOptions(options, MOUNT_OPTION_NAMES, "mount options");
  assertKnownOptions(options?.appearance, APPEARANCE_OPTION_NAMES, "appearance");

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

export const version = "1.3.0" as const;

export function mount(options: Catalog3DMountOptions): Promise<Catalog3DHandle> {
  // The loader is shipped to merchant pages that server-render. Fail with a
  // public error instead of a ReferenceError when there is no document.
  if (typeof document === "undefined" || typeof window === "undefined") {
    return Promise.reject(
      new Catalog3DError(
        "INVALID_CONFIG",
        "Catalog3D requires a browser environment.",
      ),
    );
  }

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
  let initInterval = 0;
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
  wrapper.style.cssText = WRAPPER_STYLE;
  frame.src = frameUrl.toString();
  frame.title = FRAME_TITLES[configuration.locale];
  // Eager, not lazy: the mount promise and the ready timeout both depend on the
  // handshake starting immediately, and a lazily loaded below-the-fold embed
  // would time out before the shopper ever scrolled to it.
  frame.loading = "eager";
  frame.referrerPolicy = "no-referrer";
  frame.setAttribute("allow", FRAME_PERMISSIONS);
  frame.setAttribute("allowfullscreen", "");
  frame.setAttribute(
    "sandbox",
    "allow-downloads allow-forms allow-same-origin allow-scripts",
  );
  frame.style.cssText = FRAME_STYLE;

  const rejectPendingRequests = (error: Catalog3DError) => {
    pendingRequests.forEach((pending) => {
      window.clearTimeout(pending.timeout);
      pending.reject(error);
    });
    pendingRequests.clear();
  };

  const cleanup = (removeDom: boolean) => {
    if (!destroyed) {
      destroyed = true;
      window.clearInterval(initInterval);
      window.clearTimeout(readyTimeout);
      window.removeEventListener("message", handleMessage);
      frame.removeEventListener("load", handleLoad);
      frame.removeEventListener("error", handleFrameError);
      mountedTargets.delete(target!);
      rejectPendingRequests(
        new Catalog3DError(
          "INTERNAL_ERROR",
          "Catalog3D closed before the request was accepted.",
        ),
      );
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
        // The public contract is one removal at a time. Enforcing it here means
        // a host chatbot gets a synchronous BUSY instead of racing two intents
        // through the frame.
        if (pendingRequests.size > 0) {
          throw new Catalog3DError(
            "BUSY",
            "Catalog3D is already processing a removal request.",
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

  function sendInitialization() {
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

  function handleLoad() {
    window.clearInterval(initInterval);
    if (ready) {
      // The frame navigated or was re-created (a DOM move reloads an iframe, and
      // the renderer can restore a crashed frame). Its private state is gone, so
      // in-flight intents can never be answered: reject them now rather than
      // letting each one sit until its 10s timeout.
      rejectPendingRequests(
        new Catalog3DError(
          "INTERNAL_ERROR",
          "Catalog3D reloaded before the request was accepted.",
        ),
      );
    }
    sendInitialization();
    initInterval = window.setInterval(sendInitialization, INIT_RETRY_MS);
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
      // Always stop the retry loop first. A re-ready after a frame reload used
      // to return early and leave the 500ms initialization interval running for
      // the lifetime of the host page.
      window.clearInterval(initInterval);
      window.clearTimeout(readyTimeout);
      if (ready) return;
      ready = true;
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
  wrapper.appendChild(frame);
  target.replaceChildren(wrapper);
  return readyPromise;
}

const defineRoomElement = () => {
  // Guarded so importing the loader during server rendering does not evaluate a
  // class that extends a browser-only global.
  if (
    typeof HTMLElement === "undefined" ||
    typeof customElements === "undefined" ||
    customElements.get("catalog3d-room")
  ) {
    return;
  }

  class Catalog3DRoomElement extends HTMLElement {
    #chain: Promise<void> | null = null;
    #generation = 0;
    #handle: Catalog3DHandle | null = null;
    #pending = false;
    #teardown = 0;

    connectedCallback() {
      // Moving a node fires disconnect immediately followed by connect. Cancel
      // the deferred teardown so a carousel, tab panel, or framework reorder
      // keeps its embed instead of being torn down mid-handshake.
      if (this.#teardown) {
        window.clearTimeout(this.#teardown);
        this.#teardown = 0;
      }
      if (this.#handle || this.#pending) return;
      this.#pending = true;
      const generation = ++this.#generation;
      if (!this.style.display) this.style.display = "block";
      if (!this.style.minHeight) this.style.minHeight = "420px";
      const options = this.#readOptions();

      const attempt = async () => {
        try {
          if (generation !== this.#generation) return;
          const mounted = await mount(options);
          if (generation !== this.#generation || !this.isConnected) {
            mounted.destroy();
            return;
          }
          this.#handle = mounted;
        } catch {
          // mount() already dispatched catalog3d:error on this element.
        } finally {
          if (generation === this.#generation) this.#pending = false;
        }
      };

      // Serialize attempts. A previous mount owns the target registration until
      // its promise settles and its handle is destroyed; starting the next one
      // before that would fail with TARGET_IN_USE and leave the element blank.
      // The first attempt runs synchronously so the iframe exists as soon as the
      // element connects and the host page's layout does not shift.
      this.#chain = this.#chain ? this.#chain.then(attempt, attempt) : attempt();
    }

    disconnectedCallback() {
      if (this.#teardown) return;
      this.#teardown = window.setTimeout(() => {
        this.#teardown = 0;
        this.#generation += 1;
        this.#pending = false;
        this.#handle?.destroy();
        this.#handle = null;
        // Drop the wrapper left behind by a mount that had not resolved yet.
        this.replaceChildren();
      }, 0);
    }

    #readOptions(): Catalog3DMountOptions {
      const variantId = this.getAttribute("variant-id");
      const locale = this.getAttribute("locale");
      const accentColor = this.getAttribute("accent-color");
      const fontFamily = this.getAttribute("font-family");
      return {
        target: this,
        siteId: this.getAttribute("site-id") || "",
        productId: this.getAttribute("product-id") || "",
        ...(variantId ? { variantId } : {}),
        ...(locale ? { locale: locale as Catalog3DLocale } : {}),
        appearance: {
          theme: (this.getAttribute("theme") || "auto") as Catalog3DTheme,
          ...(accentColor ? { accentColor } : {}),
          ...(fontFamily ? { fontFamily } : {}),
        },
      };
    }
  }

  customElements.define("catalog3d-room", Catalog3DRoomElement);
};

defineRoomElement();

// Tag managers, A/B tools, and app-store apps routinely inject the same third-
// party tag twice. Each copy carries its own mounted-target registry, so a
// second copy replacing the global would silently defeat TARGET_IN_USE. The
// first loader on the page wins.
if (typeof window !== "undefined") {
  const globalScope = window as unknown as Record<string, unknown>;
  const existing = globalScope.Catalog3D as { mount?: unknown } | undefined;
  if (!existing || typeof existing.mount !== "function") {
    Object.defineProperty(window, "Catalog3D", {
      configurable: true,
      enumerable: true,
      value: Object.freeze({ Catalog3DError, mount, version }),
      writable: true,
    });
  }
}
