export type Catalog3DLocale = "en" | "de" | "fr";
export type Catalog3DTheme = "auto" | "dark" | "light";

/**
 * Unknown keys are rejected with `INVALID_CONFIG`. Pass exactly these options.
 */
export type Catalog3DMountOptions = {
  target: Element | string;
  /** Publishable merchant registration id: 3-64 chars, `[a-z0-9][a-z0-9_-]*`. */
  siteId: string;
  /** Authorized published product id: 1-192 chars, `[A-Za-z0-9][A-Za-z0-9._:-]*`. */
  productId: string;
  /** Variant id in the same product family; same format as `productId`. */
  variantId?: string;
  locale?: Catalog3DLocale;
  appearance?: {
    /** Opaque three- or six-digit hex color, for example `#6750a4`. */
    accentColor?: string;
    /** A font-family stack available inside the Catalog3D iframe. */
    fontFamily?: string;
    theme?: Catalog3DTheme;
  };
};

export type Catalog3DHandle = {
  destroy(): void;
  /** One removal may be in flight at a time; a second call rejects with `BUSY`. */
  requestRemoval(request: Catalog3DRemovalRequest): Promise<void>;
};

export type Catalog3DRemovalRequest = {
  description: string;
};

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

export declare class Catalog3DError extends Error {
  readonly code: Catalog3DErrorCode;
}

export declare const version = "1.3.0";
export declare function mount(
  options: Catalog3DMountOptions,
): Promise<Catalog3DHandle>;

declare global {
  interface HTMLElementEventMap {
    "catalog3d:error": CustomEvent<{
      code: Catalog3DErrorCode;
      message: string;
    }>;
    /** Lifecycle events carry no payload; `detail` is `null`. */
    "catalog3d:ready": CustomEvent<null>;
    "catalog3d:room-ready": CustomEvent<null>;
  }

  interface HTMLElementTagNameMap {
    "catalog3d-room": HTMLElement;
  }

  interface Window {
    /** Present only after the browser tag has executed. */
    Catalog3D?: {
      Catalog3DError: typeof Catalog3DError;
      mount: typeof mount;
      version: typeof version;
    };
  }
}
