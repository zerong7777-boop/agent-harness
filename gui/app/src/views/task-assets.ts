import { cleanText, localizeStage } from "../labels-v2";
import type { AssetsIndex, AssetItem, TaskDetail, TaskSummary } from "../types";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderRecommendationCard(item: AssetItem): string {
  return `
    <article class="asset-recommendation-card">
      <div class="asset-card-head">
        <strong>${escapeHtml(cleanText(item.title, item.asset_id))}</strong>
        <span class="asset-category-badge">${escapeHtml(cleanText(item.category))}</span>
      </div>
      <p>${escapeHtml(cleanText(item.summary, "暂无摘要。"))}</p>
    </article>
  `;
}

export function renderTaskAssetsBlock(task: TaskSummary, detail: TaskDetail | undefined, assetsIndex: AssetsIndex | null): string {
  const stage = detail?.memory?.index?.current_stage ?? task.stage ?? "execution";
  const recommended = assetsIndex?.task_recommendations?.[stage] ?? [];
  const visibleItems = recommended.slice(0, 5);

  return `
    <section class="panel-block asset-recommendations">
      <div class="section-head">
        <div>
          <h3>推荐资产</h3>
          <p class="subtle-line">当前阶段：${escapeHtml(localizeStage(stage))}</p>
        </div>
        <button class="ghost-button" data-view="assets" type="button">打开资产库</button>
      </div>
      ${
        visibleItems.length
          ? `<div class="asset-recommendation-list">${visibleItems.map(renderRecommendationCard).join("")}</div>`
          : '<p class="empty-line">当前阶段还没有推荐资产。</p>'
      }
    </section>
  `;
}
