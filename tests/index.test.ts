// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const importSdk = async () => {
  vi.resetModules();
  return import("../src/index");
};

const frameMessage = (
  frame: HTMLIFrameElement,
  origin: string,
  instanceId: string,
  type: "error" | "ready" | "room-ready",
  error?: { code: string; message: string },
) => {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        protocol: "catalog3d:embed:v1",
        instanceId,
        type,
        ...(error ? { error } : {}),
      },
      origin,
      source: frame.contentWindow,
    }),
  );
};

describe("Catalog3D public embed SDK", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="room"></div>';
    vi.stubGlobal("crypto", { randomUUID: () => "instance-test" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("mounts an iframe and resolves only after a trusted ready message", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const readyListener = vi.fn();
    target.addEventListener("catalog3d:ready", readyListener);

    const mounted = mount({
      target,
      siteId: "catalog3d-demo",
      productId: "sample__oak-arc-lounge-chair",
      locale: "de",
      appearance: { theme: "light" },
    });
    const frame = target.querySelector("iframe")!;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");
    frame.dispatchEvent(new Event("load"));

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        protocol: "catalog3d:embed:v1",
        type: "init",
        instanceId: "instance-test",
        configuration: {
          appearance: { theme: "light" },
          locale: "de",
          productId: "sample__oak-arc-lounge-chair",
          siteId: "catalog3d-demo",
        },
      }),
      "https://catalog3d.ai",
    );

    frameMessage(frame, "https://catalog3d.ai", "instance-test", "ready");
    const handle = await mounted;
    expect(Object.keys(handle)).toEqual(["destroy"]);
    expect(readyListener).toHaveBeenCalledTimes(1);
    handle.destroy();
    expect(target.querySelector("iframe")).toBeNull();
  });

  it("ignores messages from another origin or iframe", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const mounted = mount({
      target,
      siteId: "catalog3d-demo",
      productId: "sample__oak-arc-lounge-chair",
    });
    const frame = target.querySelector("iframe")!;

    frameMessage(frame, "https://attacker.example", "instance-test", "ready");
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          protocol: "catalog3d:embed:v1",
          instanceId: "instance-test",
          type: "ready",
        },
        origin: "https://catalog3d.ai",
        source: window,
      }),
    );

    let resolved = false;
    void mounted.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    frameMessage(frame, "https://catalog3d.ai", "instance-test", "ready");
    (await mounted).destroy();
  });

  it("emits room-ready without exposing room details", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const listener = vi.fn();
    target.addEventListener("catalog3d:room-ready", listener);
    const mounted = mount({
      target,
      siteId: "catalog3d-demo",
      productId: "sample__oak-arc-lounge-chair",
    });
    const frame = target.querySelector("iframe")!;
    frameMessage(frame, "https://catalog3d.ai", "instance-test", "ready");
    const handle = await mounted;
    frameMessage(frame, "https://catalog3d.ai", "instance-test", "room-ready");

    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toBeNull();
    handle.destroy();
  });

  it("rejects invalid configuration without creating an iframe", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    await expect(
      mount({ target, siteId: "bad site", productId: "" }),
    ).rejects.toEqual(
      expect.objectContaining({ code: "INVALID_CONFIG" }),
    );
    expect(target.querySelector("iframe")).toBeNull();
  });

  it("maps frame failures to stable safe public errors", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const listener = vi.fn();
    target.addEventListener("catalog3d:error", listener);
    const mounted = mount({
      target,
      siteId: "catalog3d-demo",
      productId: "sample__oak-arc-lounge-chair",
    });
    const frame = target.querySelector("iframe")!;
    frameMessage(frame, "https://catalog3d.ai", "instance-test", "error", {
      code: "ORIGIN_DENIED",
      message: "This site is not authorized to use Catalog3D.",
    });

    await expect(mounted).rejects.toEqual(
      expect.objectContaining({ code: "ORIGIN_DENIED" }),
    );
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      code: "ORIGIN_DENIED",
      message: "This site is not authorized to use Catalog3D.",
    });
  });

  it("lets a ready handle remove an iframe after a later runtime error", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const mounted = mount({
      target,
      siteId: "catalog3d-demo",
      productId: "sample__oak-arc-lounge-chair",
    });
    const frame = target.querySelector("iframe")!;
    expect(frame.referrerPolicy).toBe("no-referrer");
    frameMessage(frame, "https://catalog3d.ai", "instance-test", "ready");
    const handle = await mounted;
    frameMessage(frame, "https://catalog3d.ai", "instance-test", "error", {
      code: "INTERNAL_ERROR",
      message: "Catalog3D is temporarily unavailable.",
    });
    handle.destroy();
    expect(target.querySelector("iframe")).toBeNull();
  });

  it("registers the declarative element without mutation methods", async () => {
    await importSdk();
    const element = document.createElement("catalog3d-room") as HTMLElement &
      Record<string, unknown>;
    expect(element.setProduct).toBeUndefined();
    expect(element.setItems).toBeUndefined();
    expect(element.loadRoom).toBeUndefined();
    expect(element.openRoomPicker).toBeUndefined();
  });
});
