import { createCatalog3DController } from "./catalog3d-host.js";

const media = [
  null,
  "https://storage.googleapis.com/northern-sight-459014-u8.firebasestorage.app/catalog-website/static/v14/demo-configurator/3d-chair/product-images/m1wd-lifestyle-01.webp?v=20260712-phase1",
  "https://storage.googleapis.com/northern-sight-459014-u8.firebasestorage.app/catalog-website/static/v14/demo-configurator/3d-chair/product-images/m1wd-lifestyle-02.webp?v=20260712-phase1",
  "https://storage.googleapis.com/northern-sight-459014-u8.firebasestorage.app/catalog-website/static/v14/demo-configurator/3d-chair/product-images/m1wd-lifestyle-03.webp?v=20260712-phase1",
];

const byId = (id) => document.getElementById(id);
const target = byId("catalog3d-room");
const photoLayer = byId("photo-layer");
const activePhoto = byId("active-photo");
const embedStatus = byId("embed-status");
const mediaCount = byId("media-count");
const thumbnails = [...document.querySelectorAll("[data-media-index]")];
const chatBody = byId("chat-body");
const form = byId("removal-form");
const removalInput = byId("removal-description");
const assistant = byId("assistant");
const assistantMinimized = byId("assistant-minimized");
const assistantReopen = byId("assistant-reopen");

let selectedMedia = 0;
let quantity = 1;
let bagCount = 0;
let controller;

function setEmbedStatus(message, tone = "neutral") {
  embedStatus.textContent = message;
  embedStatus.dataset.tone = tone;
}

function selectMedia(index) {
  selectedMedia = (index + media.length) % media.length;
  const showingCatalog3D = selectedMedia === 0;
  target.classList.toggle("media-layer-active", showingCatalog3D);
  target.classList.toggle("media-layer-hidden", !showingCatalog3D);
  target.setAttribute("aria-hidden", String(!showingCatalog3D));
  photoLayer.classList.toggle("media-layer-active", !showingCatalog3D);
  photoLayer.classList.toggle("media-layer-hidden", showingCatalog3D);
  photoLayer.setAttribute("aria-hidden", String(showingCatalog3D));

  if (!showingCatalog3D) activePhoto.src = media[selectedMedia];
  mediaCount.textContent = `${String(selectedMedia + 1).padStart(2, "0")} / 04`;
  embedStatus.hidden = !showingCatalog3D;

  thumbnails.forEach((thumbnail, indexValue) => {
    const active = indexValue === selectedMedia;
    thumbnail.classList.toggle("thumbnail-active", active);
    thumbnail.setAttribute("aria-selected", String(active));
  });
}

function addChatMessage(sender, text, tone = "neutral") {
  const row = document.createElement("div");
  row.className = `message-row ${sender === "user" ? "user-message" : "assistant-message"}`;
  if (sender === "assistant") {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.textContent = "A";
    row.appendChild(avatar);
  }
  const copy = document.createElement("p");
  copy.textContent = text;
  copy.dataset.tone = tone;
  row.appendChild(copy);
  chatBody.appendChild(row);
  chatBody.scrollTop = chatBody.scrollHeight;
}

async function submitRemoval(description) {
  const normalized = description.trim();
  if (!normalized) return;
  addChatMessage("user", normalized);
  removalInput.value = "";

  if (!controller?.roomReady) {
    selectMedia(0);
    addChatMessage(
      "assistant",
      "Upload a room inside Catalog3D first. I can send the removal request as soon as the room-ready event arrives.",
      "warning",
    );
    target.querySelector("iframe")?.focus();
    return;
  }

  try {
    await controller.requestRemoval(normalized);
    addChatMessage(
      "assistant",
      "Catalog3D accepted that removal request. The room experience now owns targeting, progress, preview, and the final update.",
      "success",
    );
  } catch (error) {
    const message = error?.message || "Catalog3D could not accept the removal request.";
    addChatMessage("assistant", message, "warning");
  }
}

function initializeCatalog3D() {
  try {
    controller = createCatalog3DController({
      catalog3d: window.Catalog3D,
      target,
      options: {
        siteId: document.body.dataset.siteId,
        productId: document.body.dataset.productId,
        locale: "en",
        appearance: {
          theme: "light",
          accentColor: "#274d3d",
          fontFamily: "system-ui, sans-serif",
        },
      },
      onStatus(status) {
        if (status.state === "ready") {
          setEmbedStatus("Catalog3D is ready", "success");
        } else if (status.state === "room-ready") {
          setEmbedStatus("Your room is ready", "success");
          const progress = byId("room-progress");
          progress.className = "progress-complete";
          progress.innerHTML = "2 <i>Room understood</i>";
          addChatMessage(
            "assistant",
            "Your room is ready. Describe an object to remove and I’ll send the intent through the public API.",
            "success",
          );
        } else if (status.state === "error") {
          setEmbedStatus(status.message, "warning");
        }
      },
    });

    controller.mounted.catch((error) => {
      setEmbedStatus(error?.message || "Catalog3D is unavailable", "warning");
    });
  } catch (error) {
    setEmbedStatus(error?.message || "Catalog3D is unavailable", "warning");
  }
}

thumbnails.forEach((thumbnail) => {
  thumbnail.addEventListener("click", () => selectMedia(Number(thumbnail.dataset.mediaIndex)));
});
byId("previous-media").addEventListener("click", () => selectMedia(selectedMedia - 1));
byId("next-media").addEventListener("click", () => selectMedia(selectedMedia + 1));
byId("room-cta").addEventListener("click", () => {
  selectMedia(0);
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.querySelector("iframe")?.focus();
});

document.querySelectorAll("[data-option-group]").forEach((group) => {
  group.querySelectorAll("[data-option]").forEach((button) => {
    button.addEventListener("click", () => {
      group.querySelectorAll("[data-option]").forEach((candidate) => {
        const active = candidate === button;
        candidate.classList.toggle("option-active", active);
        candidate.setAttribute("aria-pressed", String(active));
      });
      const label = button.querySelector("strong")?.textContent || "";
      byId(group.dataset.optionGroup === "material" ? "material-label" : "wood-label").textContent = label;
    });
  });
});

function renderQuantity() {
  byId("quantity").textContent = String(quantity);
  byId("bag-price").textContent = `€${689 * quantity}`;
}
byId("decrease-quantity").addEventListener("click", () => {
  quantity = Math.max(1, quantity - 1);
  renderQuantity();
});
byId("increase-quantity").addEventListener("click", () => {
  quantity = Math.min(8, quantity + 1);
  renderQuantity();
});
byId("add-to-bag").addEventListener("click", () => {
  bagCount += quantity;
  byId("bag-count").textContent = String(bagCount);
  byId("bag-button").setAttribute("aria-label", `Shopping bag with ${bagCount} items`);
  byId("add-to-bag").querySelector("span").textContent = "Added to bag";
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void submitRemoval(removalInput.value);
});
document.querySelectorAll("[data-removal]").forEach((button) => {
  button.addEventListener("click", () => void submitRemoval(button.dataset.removal));
});

byId("minimize-assistant").addEventListener("click", () => {
  assistant.hidden = true;
  assistantMinimized.hidden = false;
});
byId("close-assistant").addEventListener("click", () => {
  assistant.hidden = true;
  assistantReopen.hidden = false;
});
assistantMinimized.addEventListener("click", () => {
  assistantMinimized.hidden = true;
  assistant.hidden = false;
});
assistantReopen.addEventListener("click", () => {
  assistantReopen.hidden = true;
  assistant.hidden = false;
});

window.addEventListener("pagehide", () => controller?.destroy(), { once: true });

selectMedia(0);
initializeCatalog3D();
