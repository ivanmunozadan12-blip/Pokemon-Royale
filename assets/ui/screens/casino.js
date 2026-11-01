import { h } from "../dom.js";
import { ruletaScreen } from "./ruleta.js";
import { tragaperrasScreen } from "./tragaperras.js";

export function casinoScreen(app) {
  const root = h("div", { class: "page casino-page" });
  const tabs = h("div", { class: "casino-tabs", role: "tablist", "aria-label": "Casino" });
  const wheel = ruletaScreen(app);
  const slots = tragaperrasScreen(app);
  let active = "ruleta";
  const wheelTab = h("button", { class: "btn btn-gold", role: "tab", "aria-selected": "true", on: { click: () => select("ruleta") } }, "🎡 Ruleta diaria");
  const slotsTab = h("button", { class: "btn btn-blue", role: "tab", "aria-selected": "false", on: { click: () => select("tragaperras") } }, "🎰 Tragaperras");
  function select(id) {
    active = id; wheel.hidden = id !== "ruleta"; slots.hidden = id !== "tragaperras";
    wheelTab.className = `btn ${id === "ruleta" ? "btn-gold" : "btn-blue"}`;
    slotsTab.className = `btn ${id === "tragaperras" ? "btn-gold" : "btn-blue"}`;
    wheelTab.setAttribute("aria-selected", String(id === "ruleta"));
    slotsTab.setAttribute("aria-selected", String(id === "tragaperras"));
  }
  tabs.append(wheelTab, slotsTab); root.append(tabs, wheel, slots); select(active);
  return root;
}
