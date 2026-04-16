import type {
  BlockStatus,
  RuntimeMessage,
  TranslationBlockPayload
} from "../shared/messages";
import { createSourceHash, normalizeSourceText } from "../shared/hash";
import {
  isHackerNewsHost,
  isXHost,
  type RuntimeContext
} from "../shared/settings";
import {
  getNextViewMode,
  isTranslationViewActive,
  type ViewMode
} from "../shared/view-mode";
import {
  extractGenericBlocks,
  extractHackerNewsBlocks,
  extractXBlocks
} from "./extractors";
import {
  ensureTranslationShell,
  finalizeTranslatedText,
  markTranslationFailed,
  resetTranslatedState,
  restoreOriginalText,
  updateTranslatedText
} from "./translation-dom";
import {
  createShortcutState,
  handleTranslationShortcutEvent
} from "./shortcuts";
import { getImmediateQueueCandidates } from "./visibility";
import { getRecordViewModeAction } from "./record-view-mode";

interface BlockRecord {
  id: string;
  element: HTMLElement;
  text: string;
  sourceHash: string | null;
  translatedText: string | null;
  status: BlockStatus;
}

const blockRegistry = new Map<string, BlockRecord>();
let blockCounter = 0;
let runtimeContext: RuntimeContext | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let mutationObserver: MutationObserver | null = null;
let scanTimer: number | undefined;
const shortcutState = createShortcutState();

function isPageActive(): boolean {
  return Boolean(
    runtimeContext && isTranslationViewActive(runtimeContext.enabled, runtimeContext.viewMode)
  );
}

function getRecordText(element: HTMLElement): string {
  return normalizeSourceText(
    element.dataset.ltOriginalText ?? element.textContent ?? ""
  );
}

function getExtractor() {
  if (isXHost(location.hostname)) {
    return extractXBlocks;
  }

  if (isHackerNewsHost(location.hostname)) {
    return extractHackerNewsBlocks;
  }

  return extractGenericBlocks;
}

function markRestoredBlocksIdle(): void {
  for (const record of blockRegistry.values()) {
    if (record.status === "restored") {
      record.status = "idle";
      record.sourceHash = null;
      resetTranslatedState(record.element);
    }
  }
}

async function queueRecord(record: BlockRecord): Promise<void> {
  if (!isPageActive() || record.status !== "idle") {
    return;
  }

  record.status = "queued";
  record.sourceHash ??= await createSourceHash(record.text);
  const payload: TranslationBlockPayload = {
    blockId: record.id,
    sourceHash: record.sourceHash,
    text: record.text,
    pageUrl: location.href,
    host: location.hostname
  };

  try {
    await chrome.runtime.sendMessage({
      type: "QUEUE_VISIBLE_BLOCKS",
      blocks: [payload]
    } satisfies RuntimeMessage);
  } catch {
    record.status = "failed";
  }
}

function observeCandidates(): void {
  intersectionObserver?.disconnect();
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue;
        }

        const target = entry.target as HTMLElement;
        const blockId = target.dataset.ltBlockId;
        if (!blockId) {
          continue;
        }

        const record = blockRegistry.get(blockId);
        if (!record) {
          continue;
        }

        void queueRecord(record);
      }
    },
    {
      rootMargin: "0px 0px 320px 0px",
      threshold: 0.1
    }
  );

  for (const record of blockRegistry.values()) {
    intersectionObserver.observe(record.element);
  }
}

function scanPage(): void {
  const candidates = getExtractor()(document);
  const seen = new Set<string>();

  for (const candidate of candidates) {
    let blockId = candidate.element.dataset.ltBlockId;
    if (!blockId) {
      blockId = `lt-block-${++blockCounter}`;
      candidate.element.dataset.ltBlockId = blockId;
    }

    seen.add(blockId);
    const text = getRecordText(candidate.element);
    const existing = blockRegistry.get(blockId);

    if (!existing) {
      blockRegistry.set(blockId, {
        id: blockId,
        element: candidate.element,
        text,
        sourceHash: null,
        translatedText: null,
        status: "idle"
      });
      continue;
    }

    existing.element = candidate.element;
    if (existing.text !== text && existing.status !== "streaming") {
      existing.text = text;
      existing.sourceHash = null;
      existing.translatedText = null;
      existing.status = existing.status === "restored" ? "restored" : "idle";
    }
  }

  for (const [blockId, record] of blockRegistry.entries()) {
    if (!seen.has(blockId) || !document.contains(record.element)) {
      blockRegistry.delete(blockId);
    }
  }

  observeCandidates();
}

function scheduleScan(): void {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(() => {
    if (isPageActive()) {
      scanPage();
    }
  }, 80);
}

async function queueVisibleIdleRecords(): Promise<void> {
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const candidates = getImmediateQueueCandidates(
    Array.from(blockRegistry.values()),
    viewportHeight
  );

  await Promise.all(candidates.map((record) => queueRecord(record)));
}

function restoreAllBlocks(): void {
  for (const record of blockRegistry.values()) {
    restoreOriginalText(record.element);
    record.status = "restored";
    record.sourceHash = null;
  }
}

function applyViewModeLocally(viewMode: ViewMode): void {
  if (!runtimeContext) {
    return;
  }

  runtimeContext = {
    ...runtimeContext,
    viewMode
  };

  if (viewMode === "original") {
    restoreAllBlocks();
    return;
  }

  for (const record of blockRegistry.values()) {
    const action = getRecordViewModeAction(record, viewMode);

    if (action === "show-cached-translation" && record.translatedText) {
      ensureTranslationShell(record.element);
      updateTranslatedText(record.element, record.translatedText);
      finalizeTranslatedText(record.element);
      record.status = "done";
      continue;
    }

    if (action === "queue-translation") {
      record.status = "idle";
      resetTranslatedState(record.element);
    }
  }

  scanPage();
  void queueVisibleIdleRecords();
  scheduleScan();
}

function handleTranslationChunk(blockId: string, text: string): void {
  const record = blockRegistry.get(blockId);
  if (!record || record.status === "restored") {
    return;
  }

  ensureTranslationShell(record.element);
  updateTranslatedText(record.element, text);
  record.translatedText = text;
  record.status = "streaming";
}

function handleTranslationCompleted(blockId: string, text: string): void {
  const record = blockRegistry.get(blockId);
  if (!record || record.status === "restored") {
    return;
  }

  ensureTranslationShell(record.element);
  updateTranslatedText(record.element, text);
  finalizeTranslatedText(record.element);
  record.translatedText = text;
  record.status = "done";
}

function handleTranslationFailed(blockId: string): void {
  const record = blockRegistry.get(blockId);
  if (!record) {
    return;
  }

  markTranslationFailed(record.element);
  record.status = "failed";
}

function attachRuntimeMessageListener(): void {
  chrome.runtime.onMessage.addListener((message: RuntimeMessage) => {
    switch (message.type) {
      case "STREAM_CHUNK":
        handleTranslationChunk(message.blockId, message.text);
        break;
      case "TRANSLATION_COMPLETED":
        handleTranslationCompleted(message.blockId, message.text);
        break;
      case "TRANSLATION_FAILED":
        handleTranslationFailed(message.blockId);
        break;
      case "SITE_STATE_CHANGED":
        if (message.host !== location.hostname) {
          return;
        }

        runtimeContext = runtimeContext
          ? {
              ...runtimeContext,
              enabled: message.enabled,
              viewMode: message.viewMode,
              siteRule: message.siteRule
            }
          : runtimeContext;

        if (!message.enabled || message.viewMode === "original") {
          restoreAllBlocks();
          return;
        }

        if (message.viewMode === "translated") {
          markRestoredBlocksIdle();
          scanPage();
          void queueVisibleIdleRecords();
          scheduleScan();
        }
        break;
      case "RESTORE_TAB_ORIGINAL":
        applyViewModeLocally("original");
        break;
    }
  });
}

function attachShortcutListener(): void {
  const onShortcutEvent = async (event: KeyboardEvent) => {
    if (!runtimeContext?.enabled) {
      return;
    }

    const shouldToggle = handleTranslationShortcutEvent(shortcutState, event);
    if (!shouldToggle) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const nextViewMode = getNextViewMode(runtimeContext.viewMode);
    applyViewModeLocally(nextViewMode);

    await chrome.runtime.sendMessage({
      type: "SET_TAB_VIEW_MODE",
      host: location.hostname,
      viewMode: nextViewMode
    } satisfies RuntimeMessage);
  };

  window.addEventListener("keydown", (event) => {
    void onShortcutEvent(event);
  });
  window.addEventListener("keyup", (event) => {
    void onShortcutEvent(event);
  });
  window.addEventListener("blur", () => {
    shortcutState.pendingMetaRightTap = false;
  });
}

function attachMutationObserver(): void {
  mutationObserver?.disconnect();
  mutationObserver = new MutationObserver(() => {
    if (isPageActive()) {
      scheduleScan();
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: false
  });
}

function attachRouteListeners(): void {
  const schedule = () => {
    markRestoredBlocksIdle();
    scheduleScan();
  };

  const originalPushState = history.pushState;
  history.pushState = function pushState(...args) {
    const result = originalPushState.apply(this, args);
    schedule();
    return result;
  };

  const originalReplaceState = history.replaceState;
  history.replaceState = function replaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    schedule();
    return result;
  };

  window.addEventListener("popstate", schedule);
}

async function bootstrap(): Promise<void> {
  runtimeContext = (await chrome.runtime.sendMessage({
    type: "GET_RUNTIME_CONTEXT",
    host: location.hostname
  } satisfies RuntimeMessage)) as RuntimeContext;

  attachRuntimeMessageListener();
  attachMutationObserver();
  attachRouteListeners();
  attachShortcutListener();

  if (isPageActive()) {
    scanPage();
  }
}

void bootstrap();
