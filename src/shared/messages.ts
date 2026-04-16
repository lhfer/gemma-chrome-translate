import type { RuntimeContext, SiteRule } from "./settings";
import type { ViewMode } from "./view-mode";

export type BlockStatus =
  | "idle"
  | "queued"
  | "streaming"
  | "done"
  | "failed"
  | "restored";

export interface TranslationBlockPayload {
  blockId: string;
  sourceHash: string;
  text: string;
  pageUrl: string;
  host: string;
}

export interface PopupState extends RuntimeContext {
  tabId: number;
  canToggleSiteRule: boolean;
  connection: {
    ok: boolean;
    message: string;
  };
}

export type RuntimeMessage =
  | {
      type: "GET_RUNTIME_CONTEXT";
      host: string;
    }
  | {
      type: "GET_POPUP_STATE";
      tabId: number;
      host: string;
    }
  | {
      type: "QUEUE_VISIBLE_BLOCKS";
      blocks: TranslationBlockPayload[];
    }
  | {
      type: "STREAM_CHUNK";
      blockId: string;
      text: string;
    }
  | {
      type: "TRANSLATION_COMPLETED";
      blockId: string;
      text: string;
    }
  | {
      type: "TRANSLATION_FAILED";
      blockId: string;
      error: string;
    }
  | {
      type: "SITE_STATE_CHANGED";
      enabled: boolean;
      viewMode: ViewMode;
      siteRule: SiteRule;
      host: string;
    }
  | {
      type: "TOGGLE_SITE_RULE";
      tabId: number;
      host: string;
      enabled: boolean;
    }
  | {
      type: "SET_TAB_VIEW_MODE";
      tabId?: number;
      host: string;
      viewMode: ViewMode;
    }
  | {
      type: "RESTORE_TAB_ORIGINAL";
      tabId?: number;
    }
  | {
      type: "SAVE_SETTINGS";
      endpointBaseUrl: string;
      model: string;
      apiKey: string;
    }
  | {
      type: "PING_ENDPOINT";
      endpointBaseUrl?: string;
    };

export type RuntimeResponse =
  | RuntimeContext
  | PopupState
  | { ok: true }
  | { ok: boolean; message: string }
  | { viewMode: ViewMode };
