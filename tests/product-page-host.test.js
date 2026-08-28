// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { createCatalog3DController } from "../examples/product-page/catalog3d-host.js";

const setup = () => {
  const target = document.createElement("div");
  document.body.replaceChildren(target);
  const destroy = vi.fn();
  const requestRemoval = vi.fn().mockResolvedValue(undefined);
  const handle = { destroy, requestRemoval };
  const mount = vi.fn().mockResolvedValue(handle);
  const statuses = [];
  const controller = createCatalog3DController({
    catalog3d: { mount },
    onStatus: (status) => statuses.push(status),
    options: {
      appearance: { accentColor: "#274d3d", theme: "light" },
      locale: "en",
      productId: "product-123",
      siteId: "merchant-site",
    },
    target,
  });
  return { controller, destroy, handle, mount, requestRemoval, statuses, target };
};

describe("standalone product-page Catalog3D boundary", () => {
  it("mounts with only public configuration and forwards public lifecycle events", async () => {
    const { controller, handle, mount, statuses, target } = setup();
    await expect(controller.mounted).resolves.toBe(handle);
    expect(mount).toHaveBeenCalledWith({
      appearance: { accentColor: "#274d3d", theme: "light" },
      locale: "en",
      productId: "product-123",
      siteId: "merchant-site",
      target,
    });

    target.dispatchEvent(new CustomEvent("catalog3d:ready"));
    target.dispatchEvent(new CustomEvent("catalog3d:room-ready"));
    expect(controller.roomReady).toBe(true);
    expect(statuses).toEqual([{ state: "ready" }, { state: "room-ready" }]);
  });

  it("passes host chatbot text through requestRemoval without adding details", async () => {
    const { controller, requestRemoval } = setup();
    await controller.requestRemoval("remove the lamp by the sofa");
    expect(requestRemoval).toHaveBeenCalledWith({
      description: "remove the lamp by the sofa",
    });
  });

  it("maps only safe error detail into the host status callback", () => {
    const { statuses, target } = setup();
    target.dispatchEvent(new CustomEvent("catalog3d:error", {
      detail: { code: "ROOM_NOT_READY", message: "Upload a room first." },
    }));
    expect(statuses).toContainEqual({
      code: "ROOM_NOT_READY",
      message: "Upload a room first.",
      state: "error",
    });
  });

  it("destroys a handle that resolves after the host has already unmounted", async () => {
    const target = document.createElement("div");
    let resolveMount;
    const destroy = vi.fn();
    const mountedHandle = { destroy, requestRemoval: vi.fn() };
    const mount = vi.fn(() => new Promise((resolve) => { resolveMount = resolve; }));
    const controller = createCatalog3DController({
      catalog3d: { mount },
      options: { productId: "product-123", siteId: "merchant-site" },
      target,
    });

    controller.destroy();
    resolveMount(mountedHandle);
    await controller.mounted;
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
