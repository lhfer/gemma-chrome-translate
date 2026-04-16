import type { PopupState, RuntimeMessage } from "../shared/messages";
import { isXHost } from "../shared/settings";
import { getNextViewMode } from "../shared/view-mode";

const app = document.getElementById("app");

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  });
  return tab;
}

function attachEventDelegation(tabId: number, host: string): void {
  app?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (target.id === "pause-toggle") {
      const current = await loadState();
      if (!current) {
        return;
      }

      await chrome.runtime.sendMessage({
        type: "SET_TAB_VIEW_MODE",
        tabId,
        host,
        viewMode: getNextViewMode(current.state.viewMode)
      } satisfies RuntimeMessage);
      await loadState();
      return;
    }

    if (target.id === "restore-page") {
      await chrome.runtime.sendMessage({
        type: "RESTORE_TAB_ORIGINAL",
        tabId
      } satisfies RuntimeMessage);
      window.close();
      return;
    }

    if (target.id === "save-settings") {
      const endpointBaseUrl = (
        document.getElementById("endpoint-input") as HTMLInputElement
      ).value;
      const model = (
        document.getElementById("model-input") as HTMLInputElement
      ).value;
      const apiKey = (
        document.getElementById("api-key-input") as HTMLInputElement
      ).value;

      await chrome.runtime.sendMessage({
        type: "SAVE_SETTINGS",
        endpointBaseUrl,
        model,
        apiKey
      } satisfies RuntimeMessage);
      await loadState();
    }
  });

  app?.addEventListener("change", async (event) => {
    const target = event.target as HTMLInputElement | null;
    if (!target || target.id !== "site-toggle") {
      return;
    }

    await chrome.runtime.sendMessage({
      type: "TOGGLE_SITE_RULE",
      tabId,
      host,
      enabled: target.checked
    } satisfies RuntimeMessage);
    await loadState();
  });
}

function renderUnsupported(): void {
  if (!app) {
    return;
  }

  app.innerHTML = `
    <main class="popup-shell">
      <section class="status-panel">
        <p class="eyebrow">Local Translator</p>
        <h1>当前页面不支持</h1>
        <p class="muted">请在普通网页或 X/Twitter 页面中打开扩展。</p>
      </section>
    </main>
  `;
}

function render(state: PopupState): void {
  if (!app) {
    return;
  }

  app.innerHTML = `
    <main class="popup-shell">
      <section class="status-panel">
        <p class="eyebrow">Local Translator</p>
        <div class="hero-row">
          <div>
            <h1>${escapeHtml(state.domainKey)}</h1>
            <p class="muted">${
              state.enabled
                ? state.viewMode === "original"
                  ? "当前页正在显示原文"
                  : "当前站点自动翻译中"
                : "当前站点尚未开启自动翻译"
            }</p>
          </div>
          <span class="connection ${state.connection.ok ? "ok" : "bad"}">
            ${escapeHtml(state.connection.message)}
          </span>
        </div>
      </section>

      <section class="card">
        <label class="switch-row ${state.canToggleSiteRule ? "" : "disabled"}">
          <div>
            <span class="label-title">${
              isXHost(state.host) ? "X / Twitter 默认自动翻译" : "记住当前站点"
            }</span>
            <span class="label-sub">
              ${state.canToggleSiteRule ? "开启后该域名以后默认自动翻译" : "X/Twitter 在 v1 中固定为默认自动翻译"}
            </span>
          </div>
          <input id="site-toggle" type="checkbox" ${
            state.enabled ? "checked" : ""
          } ${state.canToggleSiteRule ? "" : "disabled"} />
        </label>
      </section>

      <section class="card button-grid">
        <button id="pause-toggle" class="ghost">
          ${state.viewMode === "original" ? "恢复当前页翻译" : "显示当前页原文"}
        </button>
        <button id="restore-page" class="ghost">恢复当前页原文</button>
      </section>

      <section class="card form-card">
        <div class="field">
          <label for="endpoint-input">oMLX 地址</label>
          <input id="endpoint-input" value="${escapeHtml(state.endpointBaseUrl)}" />
        </div>
        <div class="field">
          <label for="model-input">模型</label>
          <input id="model-input" value="${escapeHtml(state.model)}" />
        </div>
        <div class="field">
          <label for="api-key-input">API Key</label>
          <input id="api-key-input" type="password" value="${escapeHtml(state.apiKey)}" placeholder="输入本地 oMLX API key" />
        </div>
        <button id="save-settings" class="primary">保存设置</button>
      </section>
    </main>
  `;
}

async function loadState(): Promise<{
  state: PopupState;
  tabId: number;
  host: string;
} | null> {
  const tab = await getActiveTab();
  if (!tab?.id || !tab.url?.startsWith("http")) {
    renderUnsupported();
    return null;
  }

  const host = new URL(tab.url).hostname;
  const state = (await chrome.runtime.sendMessage({
    type: "GET_POPUP_STATE",
    tabId: tab.id,
    host
  } satisfies RuntimeMessage)) as PopupState;

  render(state);
  return { state, tabId: tab.id, host };
}

async function bootstrap(): Promise<void> {
  const loaded = await loadState();
  if (!loaded) {
    return;
  }

  attachEventDelegation(loaded.tabId, loaded.host);
}

void bootstrap();
