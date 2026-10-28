import { DEFAULT_SERVER, LOCAL_SERVER, normalizeServer } from "./share-url.js";

const form = document.getElementById("form");
const custom = document.getElementById("custom");
const status = document.getElementById("status");
const radios = [...form.querySelectorAll('input[name="where"]')];

const chosen = () => radios.find((r) => r.checked)?.value ?? "production";

function show(server) {
  const where = server === LOCAL_SERVER ? "local" : server === DEFAULT_SERVER ? "production" : "custom";
  radios.forEach((r) => (r.checked = r.value === where));
  custom.value = where === "custom" ? server : "";
}

chrome.storage.sync.get("server").then(({ server }) => show(server || DEFAULT_SERVER));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const where = chosen();
  const server = where === "local" ? LOCAL_SERVER : where === "custom" ? normalizeServer(custom.value) : DEFAULT_SERVER;
  status.className = "";
  if (!server) {
    status.className = "error";
    status.textContent = "That isn't a usable address. Use https://…, or http://localhost:3000 on this computer.";
    return;
  }
  await chrome.storage.sync.set({ server });
  status.textContent = `Saved. Notes go to ${server}.`;
});
