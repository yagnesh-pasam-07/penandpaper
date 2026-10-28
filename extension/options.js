import { DEFAULT_SERVER, LOCAL_SERVER, normalizeServer } from "./share-url.js";

const form = document.getElementById("form");
const custom = document.getElementById("custom");
const status = document.getElementById("status");
const radios = [...form.querySelectorAll('input[name="where"]')];
const modes = [...form.querySelectorAll('input[name="mode"]')];

const chosen = () => radios.find((r) => r.checked)?.value ?? "production";
const chosenMode = () => (modes.find((r) => r.checked)?.value === "window" ? "window" : "overlay");

function show(server, mode) {
  const where = server === LOCAL_SERVER ? "local" : server === DEFAULT_SERVER ? "production" : "custom";
  radios.forEach((r) => (r.checked = r.value === where));
  custom.value = where === "custom" ? server : "";
  modes.forEach((r) => (r.checked = r.value === mode));
}

chrome.storage.sync.get(["server", "mode"]).then(({ server, mode }) => show(server || DEFAULT_SERVER, mode === "window" ? "window" : "overlay"));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const where = chosen();
  const server = where === "local" ? LOCAL_SERVER : where === "custom" ? normalizeServer(custom.value) : DEFAULT_SERVER;
  status.className = "";
  if (!server) {
    status.className = "error";
    status.textContent = "That isn't a usable address. Use https://\u2026, or http://localhost:3000 on this computer.";
    return;
  }
  // The two built-in addresses are allowed from the start. Any other one has to
  // be allowed here, once, so the box on the page can save to it.
  if (server !== DEFAULT_SERVER && server !== LOCAL_SERVER) {
    const granted = await chrome.permissions.request({ origins: [`${server}/*`] });
    if (!granted) {
      status.className = "error";
      status.textContent = `Not saved. The extension needs your OK to talk to ${server}.`;
      return;
    }
  }
  await chrome.storage.sync.set({ server, mode: chosenMode() });
  status.textContent = `Saved. Notes go to ${server}.`;
});
