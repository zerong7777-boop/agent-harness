import type { TopLevelView } from "../types";

const ITEMS: Array<{ id: TopLevelView; label: string; disabled?: boolean }> = [
  { id: "tasks", label: "任务" },
  { id: "assets", label: "资产" },
  { id: "accounts", label: "账号 / 路由", disabled: true },
  { id: "knowledge", label: "知识 / 复盘", disabled: true },
];

export function renderTopNav(currentView: TopLevelView): string {
  return `
    <nav class="top-nav" aria-label="Primary">
      ${ITEMS.map((item) => {
        if (item.disabled) {
          return `<button class="top-nav-item" type="button" disabled aria-disabled="true">${item.label}</button>`;
        }
        const active = currentView === item.id ? "is-active" : "";
        return `<button class="top-nav-item ${active}" type="button" data-view="${item.id}" aria-pressed="${currentView === item.id}">${item.label}</button>`;
      }).join("")}
    </nav>
  `;
}
