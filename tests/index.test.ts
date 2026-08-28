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
  type:
    | "error"
    | "ready"
    | "removal-accepted"
    | "removal-rejected"
    | "room-ready",
  error?: { code: string; message: string },
  requestId?: string,
) => {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: {
        protocol: "catalog3d:embed:v1",
        instanceId,
        type,
        ...(error ? { error } : {}),
        ...(requestId ? { requestId } : {}),
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
    vi.useRealTimers();
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
      appearance: {
        accentColor: " #639 ",
        fontFamily: ' "Brand Sans", Arial, sans-serif ',
        theme: "light",
      },
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
          appearance: {
            accentColor: "#663399",
            fontFamily: '"Brand Sans", Arial, sans-serif',
            theme: "light",
          },
          locale: "de",
          productId: "sample__oak-arc-lounge-chair",
          siteId: "catalog3d-demo",
        },
      }),
      "https://catalog3d.ai",
    );

    frameMessage(frame, "https://catalog3d.ai", "instance-test", "ready");
    const handle = await mounted;
    expect(Object.keys(handle)).toEqual(["destroy", "requestRemoval"]);
    expect(readyListener).toHaveBeenCalledTimes(1);
    handle.destroy();
    expect(target.querySelector("iframe")).toBeNull();
  });

  it("retries initialization until the frame confirms it is ready", async () => {
    vi.useFakeTimers();
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const mounted = mount({
      target,
      siteId: "catalog3d-demo",
      productId: "sample__oak-arc-lounge-chair",
    });
    const frame = target.querySelector("iframe")!;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");

    frame.dispatchEvent(new Event("load"));
    expect(postMessage).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(postMessage).toHaveBeenCalledTimes(3);

    frameMessage(frame, "https://catalog3d.ai", "instance-test", "ready");
    const handle = await mounted;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(postMessage).toHaveBeenCalledTimes(3);
    handle.destroy();
    vi.useRealTimers();
  });

  it("passes a normalized text removal intent and resolves on trusted acceptance", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const mounted = mount({
      target,
      siteId: "catalog3d-demo",
      productId: "sample__oak-arc-lounge-chair",
    });
    const frame = target.querySelector("iframe")!;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");
    frameMessage(frame, "https://catalog3d.ai", "instance-test", "ready");
    const handle = await mounted;

    const accepted = handle.requestRemoval({
      description: "  remove the floor lamp by the sofa  ",
    });
    expect(postMessage).toHaveBeenCalledWith({
      protocol: "catalog3d:embed:v1",
      type: "removal-request",
      instanceId: "instance-test",
      requestId: "instance-test:removal:1",
      description: "remove the floor lamp by the sofa",
    }, "https://catalog3d.ai");

    frameMessage(
      frame,
      "https://catalog3d.ai",
      "instance-test",
      "removal-accepted",
      undefined,
      "instance-test:removal:1",
    );
    await expect(accepted).resolves.toBeUndefined();
    handle.destroy();
  });

  it("rejects invalid removal text locally and maps frame rejections safely", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const mounted = mount({
      target,
      siteId: "catalog3d-demo",
      productId: "sample__oak-arc-lounge-chair",
    });
    const frame = target.querySelector("iframe")!;
    frameMessage(frame, "https://catalog3d.ai", "instance-test", "ready");
    const handle = await mounted;

    await expect(handle.requestRemoval({ description: "   " })).rejects.toEqual(
      expect.objectContaining({ code: "INVALID_REQUEST" }),
    );

    const rejected = handle.requestRemoval({ description: "remove the chair" });
    frameMessage(
      frame,
      "https://catalog3d.ai",
      "instance-test",
      "removal-rejected",
      {
        code: "ROOM_NOT_READY",
        message: "Upload and prepare a room before requesting object removal.",
      },
      "instance-test:removal:1",
    );
    await expect(rejected).rejects.toEqual(
      expect.objectContaining({ code: "ROOM_NOT_READY" }),
    );
    expect(target.querySelector("iframe")).not.toBeNull();
    handle.destroy();
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

  it.each([
    { appearance: { accentColor: "rebeccapurple" } },
    { appearance: { accentColor: "#663399cc" } },
    { appearance: { fontFamily: "Inter; background: red" } },
    { appearance: { fontFamily: "x".repeat(201) } },
  ])("rejects unsafe appearance configuration", async (appearanceConfig) => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    await expect(mount({
      target,
      siteId: "catalog3d-demo",
      productId: "sample__oak-arc-lounge-chair",
      ...appearanceConfig,
    })).rejects.toEqual(expect.objectContaining({ code: "INVALID_CONFIG" }));
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

  it("maps declarative appearance attributes into immutable initialization", async () => {
    await importSdk();
    const element = document.createElement("catalog3d-room");
    element.setAttribute("site-id", "catalog3d-demo");
    element.setAttribute("product-id", "sample__oak-arc-lounge-chair");
    element.setAttribute("theme", "dark");
    element.setAttribute("accent-color", "#639");
    element.setAttribute("font-family", '"Brand Sans", Arial, sans-serif');
    document.body.appendChild(element);

    const frame = element.querySelector("iframe")!;
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");
    frame.dispatchEvent(new Event("load"));
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        configuration: expect.objectContaining({
          appearance: {
            accentColor: "#663399",
            fontFamily: '"Brand Sans", Arial, sans-serif',
            theme: "dark",
          },
        }),
      }),
      "https://catalog3d.ai",
    );

    element.remove();
  });
});
