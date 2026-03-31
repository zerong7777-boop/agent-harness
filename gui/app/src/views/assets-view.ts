import { cleanText } from "../labels-v2";
import type { AssetsIndex, AssetCategory, AssetItem } from "../types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isExpanded(category: AssetCategory, expandedCategories: ReadonlySet<string>): boolean {
  return expandedCategories.has(category.id);
}

function renderOverviewCard(category: AssetCategory): string {
  return `
    <article class="asset-overview-card">
      <div class="asset-overview-card-head">
        <strong>${escapeHtml(cleanText(category.title, category.id))}</strong>
        <span class="meta-chip">${category.count}</span>
      </div>
      <p>${escapeHtml(cleanText(category.description, "暂无说明。"))}</p>
    </article>
  `;
}

function renderAssetMeta(item: AssetItem): string {
  const meta: string[] = [];
  if (item.status) meta.push(cleanText(item.status));
  if (item.source_path) meta.push(cleanText(item.source_path));
  return meta.length ? meta.join(" | ") : "暂无元数据";
}

function renderAssetTags(item: AssetItem): string {
  const tags = [...(item.phase_hints ?? []), ...(item.tags ?? [])].filter(Boolean);
  if (!tags.length) return "";
  return `
    <div class="asset-tags">
      ${tags
        .slice(0, 5)
        .map((tag) => `<span class="asset-pill">${escapeHtml(cleanText(tag))}</span>`)
        .join("")}
    </div>
  `;
}

function renderAssetCard(item: AssetItem): string {
  return `
    <article class="asset-card">
      <div class="asset-card-head">
        <strong>${escapeHtml(cleanText(item.title, item.asset_id))}</strong>
        <span class="asset-category-badge">${escapeHtml(cleanText(item.category))}</span>
      </div>
      <p>${escapeHtml(cleanText(item.summary, "暂无摘要。"))}</p>
      <div class="asset-card-meta">${escapeHtml(renderAssetMeta(item))}</div>
      ${renderAssetTags(item)}
    </article>
  `;
}

function renderCategoryGroup(category: AssetCategory, expandedCategories: ReadonlySet<string>): string {
  const expanded = isExpanded(category, expandedCategories);
  return `
    <section class="asset-group">
      <button
        class="asset-group-toggle"
        data-action="toggle-asset-category"
        data-category-id="${escapeHtml(category.id)}"
        type="button"
        aria-expanded="${expanded ? "true" : "false"}"
      >
        <span>
          <strong>${escapeHtml(cleanText(category.title, category.id))}</strong>
          <span class="asset-group-description">${escapeHtml(cleanText(category.description, "浏览这一类资产。"))}</span>
        </span>
        <span class="asset-group-count">${category.count}</span>
      </button>
      ${expanded ? `<div class="asset-group-body">${category.items.map(renderAssetCard).join("")}</div>` : ""}
    </section>
  `;
}

export function renderAssetsView(index: AssetsIndex | null, expandedCategories: ReadonlySet<string>): string {
  const categories = index?.categories ?? [];
  return `
    <section class="assets-view">
      <header class="assets-hero panel-block">
        <div>
          <p class="eyebrow">Assets</p>
          <h2>资产</h2>
          <p class="summary">按分类浏览支持任务推进的 skills、guides、rules、模板和知识链接。</p>
        </div>
        <div class="assets-hero-meta">
          <span class="meta-chip">${categories.length} 个分类</span>
          <span class="meta-chip">${index?.generated_at ? "已索引" : "加载中"}</span>
        </div>
      </header>
      <section class="panel-block">
        <div class="section-head">
          <div>
            <h3>分类总览</h3>
            <p class="subtle-line">默认展开 Skills 和 Guides，其他分组按需展开。</p>
          </div>
        </div>
        <div class="asset-overview-grid">
          ${categories.map(renderOverviewCard).join("")}
        </div>
      </section>
      <section class="asset-groups">
        ${categories.map((category) => renderCategoryGroup(category, expandedCategories)).join("")}
      </section>
    </section>
  `;
}
