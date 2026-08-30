/*! Catalog3D Embed v1.3.0 | https://catalog3d.ai */

// src/index.ts
var PROTOCOL = "catalog3d:embed:v1";
var DEFAULT_HOST = "https://catalog3d.ai";
var INIT_RETRY_MS = 500;
var READY_TIMEOUT_MS = 2e4;
var REQUEST_TIMEOUT_MS = 1e4;
var REMOVAL_DESCRIPTION_MAX_LENGTH = 500;
var FONT_FAMILY_MAX_LENGTH = 200;
var SITE_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/u;
var PRODUCT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/u;
var ACCENT_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu;
var FONT_FAMILY_PATTERN = /^[\p{L}\p{N} "',._-]+$/u;
var OPTION_NAME_PATTERN = /^[A-Za-z0-9_$]{1,40}$/u;
var LOCALES = /* @__PURE__ */ new Set(["en", "de", "fr"]);
var THEMES = /* @__PURE__ */ new Set(["auto", "dark", "light"]);
var MOUNT_OPTION_NAMES = /* @__PURE__ */ new Set([
  "appearance",
  "locale",
  "productId",
  "siteId",
  "target",
  "variantId"
]);
var APPEARANCE_OPTION_NAMES = /* @__PURE__ */ new Set(["accentColor", "fontFamily", "theme"]);
var BOX_STYLE = [
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
  "max-block-size:none !important"
].join(";");
var WRAPPER_STYLE = `${BOX_STYLE};position:relative !important;overflow:hidden !important;`;
var FRAME_STYLE = `${BOX_STYLE};position:static !important;background:transparent !important;`;
var FRAME_PERMISSIONS = [
  "accelerometer",
  "camera",
  "fullscreen",
  "gyroscope",
  "magnetometer",
  "xr-spatial-tracking"
].join("; ");
var PUBLIC_ERROR_CODES = /* @__PURE__ */ new Set([
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
  "TIMEOUT"
]);
var FRAME_TITLES = Object.freeze({
  de: "Catalog3D Raumvorschau",
  en: "Catalog3D room preview",
  fr: "Aper\xE7u de la pi\xE8ce Catalog3D"
});
var Catalog3DError = class extends Error {
  code;
  constructor(code, message) {
    super(message);
    this.name = "Catalog3DError";
    this.code = code;
  }
};
var trimValue = (value) => typeof value === "string" ? value.trim() : "";
var assertKnownOptions = (value, allowed, label) => {
  if (value === void 0 || value === null) return;
  if (typeof value !== "object") {
    throw new Catalog3DError(
      "INVALID_CONFIG",
      `Catalog3D ${label} must be an object.`
    );
  }
  const unknown = Object.keys(value).filter((name) => !allowed.has(name));
  if (unknown.length === 0) return;
  const named = unknown.filter((name) => OPTION_NAME_PATTERN.test(name)).slice(0, 5);
  throw new Catalog3DError(
    "INVALID_CONFIG",
    named.length > 0 ? `Catalog3D ${label} has unsupported options: ${named.join(", ")}.` : `Catalog3D ${label} has unsupported options.`
  );
};
var normalizeAccentColor = (value) => {
  const color = trimValue(value).toLowerCase();
  if (!color) return "";
  if (!ACCENT_COLOR_PATTERN.test(color)) {
    throw new Catalog3DError(
      "INVALID_CONFIG",
      "Catalog3D accentColor must be an opaque hex color."
    );
  }
  if (color.length === 4) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }
  return color;
};
var normalizeFontFamily = (value) => {
  const fontFamily = trimValue(value);
  if (!fontFamily) return "";
  if (fontFamily.length > FONT_FAMILY_MAX_LENGTH || !FONT_FAMILY_PATTERN.test(fontFamily)) {
    throw new Catalog3DError(
      "INVALID_CONFIG",
      "Catalog3D fontFamily is invalid."
    );
  }
  return fontFamily;
};
var normalizeRemovalRequest = (value) => {
  const description = trimValue(value?.description);
  if (!description || description.length > REMOVAL_DESCRIPTION_MAX_LENGTH) {
    throw new Catalog3DError(
      "INVALID_REQUEST",
      "Catalog3D removal description must contain between 1 and 500 characters."
    );
  }
  return Object.freeze({ description });
};
var makeInstanceId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `c3d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};
var getScriptHost = () => {
  if (typeof document === "undefined") return DEFAULT_HOST;
  const script = document.currentScript;
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
var sdkHost = getScriptHost();
var mountedTargets = /* @__PURE__ */ new WeakMap();
var resolveTarget = (target) => {
  if (typeof target !== "string") {
    return target instanceof Element ? target : null;
  }
  try {
    return document.querySelector(target);
  } catch {
    return null;
  }
};
var normalizeConfiguration = (options) => {
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
  if (!LOCALES.has(locale)) {
    throw new Catalog3DError("INVALID_CONFIG", "Catalog3D locale is unsupported.");
  }
  if (!THEMES.has(theme)) {
    throw new Catalog3DError("INVALID_CONFIG", "Catalog3D theme is unsupported.");
  }
  return Object.freeze({
    appearance: Object.freeze({
      theme,
      ...accentColor ? { accentColor } : {},
      ...fontFamily ? { fontFamily } : {}
    }),
    locale,
    productId,
    siteId,
    ...variantId ? { variantId } : {}
  });
};
var dispatchPublicEvent = (target, type, detail) => {
  target.dispatchEvent(new CustomEvent(type, { detail }));
};
var readFrameMessage = (value) => {
  if (!value || typeof value !== "object") return null;
  const candidate = value;
  if (candidate.protocol !== PROTOCOL || typeof candidate.instanceId !== "string" || ![
    "error",
    "ready",
    "removal-accepted",
    "removal-rejected",
    "room-ready"
  ].includes(candidate.type || "")) {
    return null;
  }
  if (["removal-accepted", "removal-rejected"].includes(candidate.type || "") && (typeof candidate.requestId !== "string" || !candidate.requestId || candidate.requestId.length > 128)) {
    return null;
  }
  return candidate;
};
var toPublicError = (message) => {
  const candidateCode = message.error?.code;
  const code = typeof candidateCode === "string" && PUBLIC_ERROR_CODES.has(candidateCode) ? candidateCode : "INTERNAL_ERROR";
  const candidateMessage = message.error?.message;
  const safeMessage = typeof candidateMessage === "string" && candidateMessage.length <= 240 ? candidateMessage : "Catalog3D is temporarily unavailable.";
  return new Catalog3DError(code, safeMessage);
};
var version = "1.3.0";
function mount(options) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return Promise.reject(
      new Catalog3DError(
        "INVALID_CONFIG",
        "Catalog3D requires a browser environment."
      )
    );
  }
  let target = null;
  let configuration;
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
    const publicError = error instanceof Catalog3DError ? error : new Catalog3DError("INVALID_CONFIG", "Catalog3D configuration is invalid.");
    if (target) {
      dispatchPublicEvent(target, "catalog3d:error", {
        code: publicError.code,
        message: publicError.message
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
  let rejectReady = () => void 0;
  let resolveReady = () => void 0;
  const pendingRequests = /* @__PURE__ */ new Map();
  wrapper.dataset.catalog3dEmbed = "v1";
  wrapper.style.cssText = WRAPPER_STYLE;
  frame.src = frameUrl.toString();
  frame.title = FRAME_TITLES[configuration.locale];
  frame.loading = "eager";
  frame.referrerPolicy = "no-referrer";
  frame.setAttribute("allow", FRAME_PERMISSIONS);
  frame.setAttribute("allowfullscreen", "");
  frame.setAttribute(
    "sandbox",
    "allow-downloads allow-forms allow-same-origin allow-scripts"
  );
  frame.style.cssText = FRAME_STYLE;
  const rejectPendingRequests = (error) => {
    pendingRequests.forEach((pending) => {
      window.clearTimeout(pending.timeout);
      pending.reject(error);
    });
    pendingRequests.clear();
  };
  const cleanup = (removeDom) => {
    if (!destroyed) {
      destroyed = true;
      window.clearInterval(initInterval);
      window.clearTimeout(readyTimeout);
      window.removeEventListener("message", handleMessage);
      frame.removeEventListener("load", handleLoad);
      frame.removeEventListener("error", handleFrameError);
      mountedTargets.delete(target);
      rejectPendingRequests(
        new Catalog3DError(
          "INTERNAL_ERROR",
          "Catalog3D closed before the request was accepted."
        )
      );
    }
    if (removeDom) wrapper.remove();
  };
  const handle = Object.freeze({
    destroy() {
      cleanup(true);
    },
    requestRemoval(request) {
      let normalizedRequest;
      try {
        if (destroyed || !ready || !frame.contentWindow) {
          throw new Catalog3DError(
            "INTERNAL_ERROR",
            "Catalog3D is not available for removal requests."
          );
        }
        if (pendingRequests.size > 0) {
          throw new Catalog3DError(
            "BUSY",
            "Catalog3D is already processing a removal request."
          );
        }
        normalizedRequest = normalizeRemovalRequest(request);
      } catch (error) {
        const publicError = error instanceof Catalog3DError ? error : new Catalog3DError("INVALID_REQUEST", "Catalog3D removal request is invalid.");
        dispatchPublicEvent(target, "catalog3d:error", {
          code: publicError.code,
          message: publicError.message
        });
        return Promise.reject(publicError);
      }
      const requestId = `${instanceId}:removal:${++requestSequence}`;
      return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          pendingRequests.delete(requestId);
          const error = new Catalog3DError(
            "TIMEOUT",
            "Catalog3D took too long to accept the removal request."
          );
          dispatchPublicEvent(target, "catalog3d:error", {
            code: error.code,
            message: error.message
          });
          reject(error);
        }, REQUEST_TIMEOUT_MS);
        pendingRequests.set(requestId, { reject, resolve, timeout });
        frame.contentWindow.postMessage(
          {
            protocol: PROTOCOL,
            type: "removal-request",
            instanceId,
            requestId,
            description: normalizedRequest.description
          },
          sdkHost
        );
      });
    }
  });
  mountedTargets.set(target, handle);
  const fail = (error, removeDom) => {
    dispatchPublicEvent(target, "catalog3d:error", {
      code: error.code,
      message: error.message
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
        configuration
      },
      sdkHost
    );
  }
  function handleLoad() {
    window.clearInterval(initInterval);
    if (ready) {
      rejectPendingRequests(
        new Catalog3DError(
          "INTERNAL_ERROR",
          "Catalog3D reloaded before the request was accepted."
        )
      );
    }
    sendInitialization();
    initInterval = window.setInterval(sendInitialization, INIT_RETRY_MS);
  }
  function handleFrameError() {
    fail(
      new Catalog3DError(
        "FRAME_LOAD_FAILED",
        "Catalog3D could not load the room experience."
      ),
      true
    );
  }
  function handleMessage(event) {
    if (destroyed || event.origin !== sdkHost || event.source !== frame.contentWindow) {
      return;
    }
    const message = readFrameMessage(event.data);
    if (!message || message.instanceId !== instanceId) return;
    if (message.type === "ready") {
      window.clearInterval(initInterval);
      window.clearTimeout(readyTimeout);
      if (ready) return;
      ready = true;
      dispatchPublicEvent(target, "catalog3d:ready");
      resolveReady(handle);
      return;
    }
    if (message.type === "room-ready") {
      if (ready) dispatchPublicEvent(target, "catalog3d:room-ready");
      return;
    }
    if (message.type === "removal-accepted" || message.type === "removal-rejected") {
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
      dispatchPublicEvent(target, "catalog3d:error", {
        code: error.code,
        message: error.message
      });
      pending.reject(error);
      return;
    }
    fail(toPublicError(message), false);
  }
  window.addEventListener("message", handleMessage);
  frame.addEventListener("load", handleLoad);
  frame.addEventListener("error", handleFrameError);
  const readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
    readyTimeout = window.setTimeout(() => {
      fail(
        new Catalog3DError("TIMEOUT", "Catalog3D took too long to become ready."),
        true
      );
    }, READY_TIMEOUT_MS);
  });
  wrapper.appendChild(frame);
  target.replaceChildren(wrapper);
  return readyPromise;
}
var defineRoomElement = () => {
  if (typeof HTMLElement === "undefined" || typeof customElements === "undefined" || customElements.get("catalog3d-room")) {
    return;
  }
  class Catalog3DRoomElement extends HTMLElement {
    #chain = null;
    #generation = 0;
    #handle = null;
    #pending = false;
    #teardown = 0;
    connectedCallback() {
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
        } finally {
          if (generation === this.#generation) this.#pending = false;
        }
      };
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
        this.replaceChildren();
      }, 0);
    }
    #readOptions() {
      const variantId = this.getAttribute("variant-id");
      const locale = this.getAttribute("locale");
      const accentColor = this.getAttribute("accent-color");
      const fontFamily = this.getAttribute("font-family");
      return {
        target: this,
        siteId: this.getAttribute("site-id") || "",
        productId: this.getAttribute("product-id") || "",
        ...variantId ? { variantId } : {},
        ...locale ? { locale } : {},
        appearance: {
          theme: this.getAttribute("theme") || "auto",
          ...accentColor ? { accentColor } : {},
          ...fontFamily ? { fontFamily } : {}
        }
      };
    }
  }
  customElements.define("catalog3d-room", Catalog3DRoomElement);
};
defineRoomElement();
if (typeof window !== "undefined") {
  const globalScope = window;
  const existing = globalScope.Catalog3D;
  if (!existing || typeof existing.mount !== "function") {
    Object.defineProperty(window, "Catalog3D", {
      configurable: true,
      enumerable: true,
      value: Object.freeze({ Catalog3DError, mount, version }),
      writable: true
    });
  }
}
export {
  Catalog3DError,
  mount,
  version
};
