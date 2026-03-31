export function renderTasksView(content: { sidebar: string; workspace: string; modal: string }): string {
  return `
    <section class="tasks-view">
      <div class="layout">
        ${content.sidebar}
        ${content.workspace}
      </div>
      ${content.modal}
    </section>
  `;
}
