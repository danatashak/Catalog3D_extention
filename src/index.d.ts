export type Catalog3DLocale = "en" | "de" | "fr";
export type Catalog3DTheme = "auto" | "dark" | "light";

export type Catalog3DMountOptions = {
  target: Element | string;
  siteId: string;
  productId: string;
  variantId?: string;
  locale?: Catalog3DLocale;
  appearance?: {
    theme?: Catalog3DTheme;
  };
};

export type Catalog3DHandle = {
  destroy(): void;
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

export declare const version = "1.1.0";
export declare function mount(
  options: Catalog3DMountOptions,
): Promise<Catalog3DHandle>;

declare global {
  interface HTMLElementEventMap {
    "catalog3d:error": CustomEvent<{
      code: Catalog3DErrorCode;
      message: string;
    }>;
    "catalog3d:ready": CustomEvent<undefined>;
    "catalog3d:room-ready": CustomEvent<undefined>;
  }

  interface HTMLElementTagNameMap {
    "catalog3d-room": HTMLElement;
  }

  interface Window {
    Catalog3D: {
      Catalog3DError: typeof Catalog3DError;
      mount: typeof mount;
      version: typeof version;
    };
  }
}
