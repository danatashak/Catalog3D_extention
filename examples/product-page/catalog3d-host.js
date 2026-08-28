/**
 * The complete merchant-to-Catalog3D boundary used by the product-page example.
 * It deliberately knows nothing about iframe internals, rooms, jobs, or assets.
 */
export function createCatalog3DController({ catalog3d, onStatus, options, target }) {
  if (!catalog3d?.mount) {
    throw new Error("Catalog3D loader is unavailable.");
  }

  let destroyed = false;
  let handle;
  let roomReady = false;

  const emit = (state, detail = {}) => onStatus?.({ state, ...detail });

  const onReady = () => emit("ready");
  const onRoomReady = () => {
    roomReady = true;
    emit("room-ready");
  };
  const onError = (event) => {
    const detail = event.detail || {};
    emit("error", {
      code: detail.code || "INTERNAL_ERROR",
      message: detail.message || "Catalog3D is temporarily unavailable.",
    });
  };

  target.addEventListener("catalog3d:ready", onReady);
  target.addEventListener("catalog3d:room-ready", onRoomReady);
  target.addEventListener("catalog3d:error", onError);

  const mounted = catalog3d.mount({ ...options, target }).then((nextHandle) => {
    if (destroyed) {
      nextHandle.destroy();
      return undefined;
    }
    handle = nextHandle;
    return handle;
  });

  return Object.freeze({
    async requestRemoval(description) {
      const mountedHandle = handle || await mounted;
      if (!mountedHandle) {
        throw new Error("Catalog3D is no longer mounted.");
      }
      return mountedHandle.requestRemoval({ description });
    },
    get roomReady() {
      return roomReady;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      target.removeEventListener("catalog3d:ready", onReady);
      target.removeEventListener("catalog3d:room-ready", onRoomReady);
      target.removeEventListener("catalog3d:error", onError);
      handle?.destroy();
    },
    mounted,
  });
}
