import { LruCache } from "./lru-cache";
import {
  buildOpenAIHeaders,
  normalizeConfiguredModelId
} from "./request-config";
import {
  collectDeltaFromSsePayload,
  createThrottledEmitter
} from "./streaming";
import type {
  PopupState,
  RuntimeMessage,
  RuntimeResponse,
  TranslationBlockPayload
} from "../shared/messages";
import {
  DEFAULT_SETTINGS,
  getDomainKey,
  isXHost,
  mergeSettings,
  normalizeEndpointBaseUrl,
  resolveSiteRule,
  TRANSLATION_SYSTEM_PROMPT,
  type ExtensionSettings,
  type RuntimeContext
} from "../shared/settings";
import { isTranslationViewActive, type ViewMode } from "../shared/view-mode";

interface QueueEntry {
  sourceHash: string;
  text: string;
  host: string;
  pageUrl: string;
  epoch: number;
}

interface TabRuntimeState {
  viewMode: ViewMode;
  epoch: number;
  inflightCount: number;
  queue: string[];
  queuedEntries: Map<string, QueueEntry>;
  subscribers: Map<string, Set<string>>;
  cooldowns: Map<string, number>;
}

const translationCache = new LruCache<string, string>(500);
const tabStates = new Map<number, TabRuntimeState>();

function getTabState(tabId: number): TabRuntimeState {
  const existing = tabStates.get(tabId);
  if (existing) {
    return existing;
  }

  const created: TabRuntimeState = {
    viewMode: "translated",
    epoch: 0,
    inflightCount: 0,
    queue: [],
    queuedEntries: new Map(),
    subscribers: new Map(),
    cooldowns: new Map()
  };
  tabStates.set(tabId, created);
  return created;
}

function resetTabState(tabId: number, incrementEpoch = true): void {
  const state = getTabState(tabId);
  if (incrementEpoch) {
    state.epoch += 1;
  }
  state.inflightCount = 0;
  state.queue = [];
  state.queuedEntries.clear();
  state.subscribers.clear();
}

async function readSettings(): Promise<ExtensionSettings> {
  const raw = (await chrome.storage.local.get(
    DEFAULT_SETTINGS
  )) as Partial<ExtensionSettings>;
  return mergeSettings(raw);
}

async function writeSettings(
  partial: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const merged = {
    ...(await readSettings()),
    ...partial
  };
  await chrome.storage.local.set(merged);
  return mergeSettings(merged);
}

function buildRuntimeContext(
  host: string,
  settings: ExtensionSettings,
  viewMode: ViewMode
): RuntimeContext {
  const siteRule = resolveSiteRule(host, settings);
  return {
    host,
    domainKey: getDomainKey(host),
    enabled: siteRule === "auto",
    viewMode,
    siteRule,
    endpointBaseUrl: settings.endpointBaseUrl,
    model: settings.model,
    apiKey: settings.apiKey,
    translationStyle: settings.translationStyle
  };
}

async function pingEndpoint(
  endpointBaseUrl: string,
  apiKey: string
): Promise<{
  ok: boolean;
  message: string;
}> {
  const normalized = normalizeEndpointBaseUrl(endpointBaseUrl);

  try {
    const response = await fetch(`${normalized}/models`, {
      method: "GET",
      headers: buildOpenAIHeaders(apiKey)
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          ok: false,
          message: apiKey.trim() ? "API key 无效" : "需要 API key"
        };
      }

      return {
        ok: false,
        message: `连接失败 (${response.status})`
      };
    }

    return {
      ok: true,
      message: "本地 oMLX 已连接"
    };
  } catch {
    return {
      ok: false,
      message: "未连接到本地 oMLX"
    };
  }
}

async function buildPopupState(
  tabId: number,
  host: string
): Promise<PopupState> {
  const settings = await readSettings();
  const state = getTabState(tabId);
  return {
    ...buildRuntimeContext(host, settings, state.viewMode),
    tabId,
    canToggleSiteRule: !isXHost(host),
    connection: await pingEndpoint(settings.endpointBaseUrl, settings.apiKey)
  };
}

async function safeSendToTab(
  tabId: number,
  message: RuntimeMessage
): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch {
    // Ignore tabs without listeners or tabs that navigated away.
  }
}

function subscribeBlock(
  tabState: TabRuntimeState,
  payload: TranslationBlockPayload
): void {
  const existing = tabState.subscribers.get(payload.sourceHash) ?? new Set();
  existing.add(payload.blockId);
  tabState.subscribers.set(payload.sourceHash, existing);
}

function broadcastToSubscribers(
  tabId: number,
  sourceHash: string,
  messageFactory: (blockId: string) => RuntimeMessage,
  epoch: number
): void {
  const tabState = getTabState(tabId);
  if (tabState.epoch !== epoch) {
    return;
  }

  const subscribers = tabState.subscribers.get(sourceHash);
  if (!subscribers) {
    return;
  }

  for (const blockId of subscribers) {
    void safeSendToTab(tabId, messageFactory(blockId));
  }
}

async function translateQueuedEntry(tabId: number, entry: QueueEntry): Promise<void> {
  const tabState = getTabState(tabId);
  const settings = await readSettings();
  const endpoint = `${normalizeEndpointBaseUrl(settings.endpointBaseUrl)}/chat/completions`;
  const modelId = normalizeConfiguredModelId(settings.model);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let aggregated = "";
    const emitter = createThrottledEmitter(120, (value) => {
      broadcastToSubscribers(
        tabId,
        entry.sourceHash,
        (blockId) => ({
          type: "STREAM_CHUNK",
          blockId,
          text: value
        }),
        entry.epoch
      );
    });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: buildOpenAIHeaders(settings.apiKey),
        body: JSON.stringify({
          model: modelId,
          stream: true,
          temperature: 0.2,
          messages: [
            { role: "system", content: TRANSLATION_SYSTEM_PROMPT },
            { role: "user", content: entry.text }
          ]
        })
      });

      if (!response.ok || !response.body) {
        throw new Error(`Translation request failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const dataLines = rawEvent
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.replace(/^data:\s*/, "").trim())
            .filter(Boolean);

          for (const payload of dataLines) {
            if (payload === "[DONE]") {
              continue;
            }

            const delta = collectDeltaFromSsePayload(payload);
            if (delta) {
              aggregated += delta;
              emitter.push(aggregated);
            }
          }
        }
      }

      emitter.flush();
      translationCache.set(entry.sourceHash, aggregated);
      broadcastToSubscribers(
        tabId,
        entry.sourceHash,
        (blockId) => ({
          type: "TRANSLATION_COMPLETED",
          blockId,
          text: aggregated
        }),
        entry.epoch
      );
      return;
    } catch (error) {
      emitter.cancel();
      if (attempt === 1) {
        tabState.cooldowns.set(entry.sourceHash, Date.now() + 30_000);
        broadcastToSubscribers(
          tabId,
          entry.sourceHash,
          (blockId) => ({
            type: "TRANSLATION_FAILED",
            blockId,
            error:
              error instanceof Error ? error.message : "Translation request failed"
          }),
          entry.epoch
        );
      }
    }
  }
}

function pumpQueue(tabId: number): void {
  const state = getTabState(tabId);
  if (state.viewMode !== "translated") {
    return;
  }

  while (state.inflightCount < 3 && state.queue.length > 0) {
    const sourceHash = state.queue.shift();
    if (!sourceHash) {
      return;
    }

    const entry = state.queuedEntries.get(sourceHash);
    if (!entry) {
      continue;
    }

    state.queuedEntries.delete(sourceHash);
    state.inflightCount += 1;

    void translateQueuedEntry(tabId, entry).finally(() => {
      const liveState = getTabState(tabId);
      if (liveState.epoch === entry.epoch) {
        liveState.inflightCount = Math.max(0, liveState.inflightCount - 1);
        liveState.subscribers.delete(sourceHash);
        pumpQueue(tabId);
      }
    });
  }
}

async function handleQueuedBlocks(
  tabId: number,
  blocks: TranslationBlockPayload[]
): Promise<void> {
  const state = getTabState(tabId);

  for (const block of blocks) {
    subscribeBlock(state, block);

    const cached = translationCache.get(block.sourceHash);
    if (cached) {
      await safeSendToTab(tabId, {
        type: "TRANSLATION_COMPLETED",
        blockId: block.blockId,
        text: cached
      });
      continue;
    }

    if ((state.cooldowns.get(block.sourceHash) ?? 0) > Date.now()) {
      continue;
    }

    if (!state.queuedEntries.has(block.sourceHash)) {
      state.queue.push(block.sourceHash);
      state.queuedEntries.set(block.sourceHash, {
        sourceHash: block.sourceHash,
        text: block.text,
        host: block.host,
        pageUrl: block.pageUrl,
        epoch: state.epoch
      });
    }
  }

  pumpQueue(tabId);
}

async function handleMessage(
  message: RuntimeMessage,
  sender: chrome.runtime.MessageSender
): Promise<RuntimeResponse> {
  switch (message.type) {
    case "GET_RUNTIME_CONTEXT": {
      const settings = await readSettings();
      const viewMode = sender.tab?.id
        ? getTabState(sender.tab.id).viewMode
        : "translated";
      return buildRuntimeContext(message.host, settings, viewMode);
    }

    case "GET_POPUP_STATE":
      return buildPopupState(message.tabId, message.host);

    case "QUEUE_VISIBLE_BLOCKS": {
      if (!sender.tab?.id) {
        return { ok: true };
      }

      await handleQueuedBlocks(sender.tab.id, message.blocks);
      return { ok: true };
    }

    case "TOGGLE_SITE_RULE": {
      const settings = await readSettings();
      if (!isXHost(message.host)) {
        const domainKey = getDomainKey(message.host);
        const nextSiteRules = {
          ...settings.siteRules,
          [domainKey]: message.enabled ? "auto" : "off"
        };
        await chrome.storage.local.set({ siteRules: nextSiteRules });
      }

      resetTabState(message.tabId);
      getTabState(message.tabId).viewMode = "translated";
      const updated = await buildPopupState(message.tabId, message.host);
      await safeSendToTab(message.tabId, {
        type: "SITE_STATE_CHANGED",
        enabled: updated.enabled,
        viewMode: updated.viewMode,
        siteRule: updated.siteRule,
        host: message.host
      });
      return updated;
    }

    case "SET_TAB_VIEW_MODE": {
      const tabId = message.tabId ?? sender.tab?.id;
      if (tabId === undefined) {
        return { viewMode: "translated" };
      }

      const state = getTabState(tabId);
      state.viewMode = message.viewMode;
      if (message.viewMode === "original") {
        resetTabState(tabId, false);
        state.viewMode = "original";
      } else {
        pumpQueue(tabId);
      }

      const settings = await readSettings();
      const context = buildRuntimeContext(message.host, settings, state.viewMode);
      await safeSendToTab(tabId, {
        type: "SITE_STATE_CHANGED",
        enabled: context.enabled,
        viewMode: context.viewMode,
        siteRule: context.siteRule,
        host: message.host
      });
      return { viewMode: state.viewMode };
    }

    case "RESTORE_TAB_ORIGINAL": {
      const tabId = message.tabId ?? sender.tab?.id;
      if (tabId !== undefined) {
        resetTabState(tabId);
        getTabState(tabId).viewMode = "original";
        await safeSendToTab(tabId, { type: "RESTORE_TAB_ORIGINAL" });
      }
      return { ok: true };
    }

    case "SAVE_SETTINGS": {
      await writeSettings({
        endpointBaseUrl: message.endpointBaseUrl,
        model: normalizeConfiguredModelId(message.model),
        apiKey: message.apiKey
      });
      return { ok: true };
    }

    case "PING_ENDPOINT": {
      const settings = await readSettings();
      return pingEndpoint(
        message.endpointBaseUrl ?? settings.endpointBaseUrl,
        settings.apiKey
      );
    }

    default:
      return { ok: false, message: "Unsupported message" };
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const settings = await readSettings();
  await chrome.storage.local.set(settings);
});

chrome.tabs.onRemoved.addListener((tabId) => {
  tabStates.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    resetTabState(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message as RuntimeMessage, sender)
    .then((response) => sendResponse(response))
    .catch((error: unknown) => {
      sendResponse({
        ok: false,
        message: error instanceof Error ? error.message : "Unknown error"
      });
    });
  return true;
});
