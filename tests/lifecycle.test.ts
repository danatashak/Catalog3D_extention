// @vitest-environment jsdom

/**
 * Regression tests for the pre-publication hardening pass. Each block names the
 * defect it locks down.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const HOST = "https://catalog3d.ai";

const importSdk = async () => {
  vi.resetModules();
  return import("../src/index");
};

const post = (
  frame: HTMLIFrameElement,
  type: string,
  extra: Record<string, unknown> = {},
) => {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { protocol: "catalog3d:embed:v1", instanceId: "instance-test", type, ...extra },
      origin: HOST,
      source: frame.contentWindow,
    }),
  );
};

const mountReady = async (
  mount: typeof import("../src/index").mount,
  target: Element,
  options: Record<string, unknown> = {},
) => {
  const mounted = mount({
    target,
    siteId: "catalog3d-demo",
    productId: "sample__oak-arc-lounge-chair",
    ...options,
  } as never);
  const frame = target.querySelector("iframe")!;
  post(frame, "ready");
  return { frame, handle: await mounted };
};

describe("frame reload handling", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="room"></div>';
    vi.stubGlobal("crypto", { randomUUID: () => "instance-test" });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("stops the initialization retry loop when a reloaded frame re-announces ready", async () => {
    vi.useFakeTimers();
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const { frame, handle } = await mountReady(mount, target);
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");

    // A DOM move reloads an iframe, and the renderer restores crashed frames.
    frame.dispatchEvent(new Event("load"));
    post(frame, "ready");
    postMessage.mockClear();
    await vi.advanceTimersByTimeAsync(5_000);

    expect(postMessage).not.toHaveBeenCalled();
    handle.destroy();
  });

  it("rejects an in-flight removal when the frame reloads under it", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const { frame, handle } = await mountReady(mount, target);

    const pending = handle.requestRemoval({ description: "remove the floor lamp" });
    frame.dispatchEvent(new Event("load"));

    await expect(pending).rejects.toEqual(
      expect.objectContaining({ code: "INTERNAL_ERROR" }),
    );
    handle.destroy();
  });
});

describe("public contract enforcement", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="room"></div>';
    vi.stubGlobal("crypto", { randomUUID: () => "instance-test" });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects a second concurrent removal with BUSY instead of racing both", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const { frame, handle } = await mountReady(mount, target);
    const postMessage = vi.spyOn(frame.contentWindow!, "postMessage");

    const first = handle.requestRemoval({ description: "remove the floor lamp" });
    await expect(
      handle.requestRemoval({ description: "remove the rug" }),
    ).rejects.toEqual(expect.objectContaining({ code: "BUSY" }));
    expect(postMessage).toHaveBeenCalledTimes(1);

    post(frame, "removal-accepted", { requestId: "instance-test:removal:1" });
    await expect(first).resolves.toBeUndefined();

    // The slot frees up once the frame answers, so the next intent goes through.
    const second = handle.requestRemoval({ description: "remove the rug" });
    post(frame, "removal-accepted", { requestId: "instance-test:removal:2" });
    await expect(second).resolves.toBeUndefined();
    handle.destroy();
  });

  it("refuses a second mount on a target that already owns one", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const { handle } = await mountReady(mount, target);

    await expect(
      mount({ target, siteId: "catalog3d-demo", productId: "other-product" }),
    ).rejects.toEqual(expect.objectContaining({ code: "TARGET_IN_USE" }));
    handle.destroy();
  });

  it("times out and removes the frame when the room never becomes ready", async () => {
    vi.useFakeTimers();
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const mounted = mount({
      target,
      siteId: "catalog3d-demo",
      productId: "sample__oak-arc-lounge-chair",
    });
    const rejection = expect(mounted).rejects.toEqual(
      expect.objectContaining({ code: "TIMEOUT" }),
    );
    await vi.advanceTimersByTimeAsync(20_000);
    await rejection;
    expect(target.querySelector("iframe")).toBeNull();
  });

  it.each([
    { label: "a misspelled mount option", options: { local: "de" } },
    { label: "an unknown mount option", options: { authToken: "secret" } },
    { label: "a misspelled appearance token", options: { appearance: { accentcolor: "#639" } } },
  ])("rejects $label instead of silently ignoring it", async ({ options }) => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    await expect(
      mount({
        target,
        siteId: "catalog3d-demo",
        productId: "sample__oak-arc-lounge-chair",
        ...options,
      } as never),
    ).rejects.toEqual(expect.objectContaining({ code: "INVALID_CONFIG" }));
    expect(target.querySelector("iframe")).toBeNull();
  });

  it.each([
    "authToken",
    "<img src=x onerror=alert(1)>",
  ])("never echoes an unknown option name (%s) into the public message", async (name) => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    await expect(
      mount({
        target,
        siteId: "catalog3d-demo",
        productId: "sample__oak-arc-lounge-chair",
        [name]: true,
      } as never),
    ).rejects.toEqual(
      expect.objectContaining({
        code: "INVALID_CONFIG",
        message: "Catalog3D mount options has unsupported options.",
      }),
    );
  });
});

describe("iframe hardening for unknown host pages", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="room"></div>';
    vi.stubGlobal("crypto", { randomUUID: () => "instance-test" });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not delegate unused device or fullscreen permissions", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const { handle } = await mountReady(mount, target);
    const frame = target.querySelector("iframe")!;

    expect(frame.hasAttribute("allow")).toBe(false);
    expect(frame.hasAttribute("allowfullscreen")).toBe(false);
    expect(frame.getAttribute("sandbox")).toBe(
      "allow-downloads allow-forms allow-same-origin allow-scripts",
    );
    handle.destroy();
  });

  it("declares loader-owned geometry !important so host CSS cannot collapse it", async () => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const { handle } = await mountReady(mount, target);
    const wrapper = target.querySelector<HTMLElement>("[data-catalog3d-embed]")!;
    const frame = target.querySelector("iframe")!;

    ["display", "inline-size", "block-size", "margin", "border"].forEach((property) => {
      expect(wrapper.style.getPropertyPriority(property)).toBe("important");
      expect(frame.style.getPropertyPriority(property)).toBe("important");
    });
    handle.destroy();
  });

  it.each([
    { locale: "de", title: "Catalog3D Raumvorschau" },
    { locale: "fr", title: "Aperçu de la pièce Catalog3D" },
    { locale: "en", title: "Catalog3D room preview" },
  ])("labels the frame in $locale for assistive technology", async ({ locale, title }) => {
    const { mount } = await importSdk();
    const target = document.querySelector("#room")!;
    const { handle } = await mountReady(mount, target, { locale });
    expect(target.querySelector("iframe")!.title).toBe(title);
    handle.destroy();
  });

  it("keeps the first loader when a tag manager injects the script twice", async () => {
    delete (window as { Catalog3D?: unknown }).Catalog3D;
    await importSdk();
    const first = (window as { Catalog3D?: unknown }).Catalog3D;
    expect(first).toBeDefined();

    await importSdk();
    expect((window as { Catalog3D?: unknown }).Catalog3D).toBe(first);
  });
});

describe("declarative element lifecycle", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="a"></div><div id="b"></div>';
    vi.stubGlobal("crypto", { randomUUID: () => "instance-test" });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const makeElement = () => {
    const element = document.createElement("catalog3d-room");
    element.setAttribute("site-id", "catalog3d-demo");
    element.setAttribute("product-id", "sample__oak-arc-lounge-chair");
    return element;
  };

  it("survives being re-parented while the handshake is still in flight", async () => {
    await importSdk();
    const element = makeElement();
    document.querySelector("#a")!.appendChild(element);
    const frame = element.querySelector("iframe");
    expect(frame).not.toBeNull();

    // A carousel, tab panel, or framework reorder moves the node: disconnect is
    // immediately followed by connect, and must not tear the mount down.
    document.querySelector("#b")!.appendChild(element);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.querySelector("iframe")).toBe(frame);
    element.remove();
  });

  it("mounts even when the element carries placeholder fallback content", async () => {
    await importSdk();
    const element = makeElement();
    element.innerHTML = "<p>Loading your room…</p>";
    document.querySelector("#a")!.appendChild(element);

    expect(element.querySelector("iframe")).not.toBeNull();
    element.remove();
  });

  it("tears down for real when the element is removed and left out", async () => {
    await importSdk();
    const element = makeElement();
    document.querySelector("#a")!.appendChild(element);
    element.remove();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(element.querySelector("iframe")).toBeNull();
    expect(element.childElementCount).toBe(0);
  });

  it("mounts again after the element is removed and later re-added", async () => {
    vi.useFakeTimers();
    await importSdk();
    const element = makeElement();
    document.querySelector("#a")!.appendChild(element);
    const firstFrame = element.querySelector("iframe");
    element.remove();
    await vi.advanceTimersByTimeAsync(0);
    expect(element.querySelector("iframe")).toBeNull();

    document.querySelector("#b")!.appendChild(element);
    await vi.advanceTimersByTimeAsync(0);

    expect(element.querySelector("iframe")).not.toBeNull();
    expect(element.querySelector("iframe")).not.toBe(firstFrame);
    element.remove();
    await vi.advanceTimersByTimeAsync(0);
  });
});
