export type SiteRule = "auto" | "off";
import type { ViewMode } from "./view-mode";

export interface ExtensionSettings {
  siteRules: Record<string, SiteRule>;
  xDefaultEnabled: boolean;
  endpointBaseUrl: string;
  model: string;
  apiKey: string;
  translationStyle: "natural-zh-CN";
}

export interface RuntimeContext {
  host: string;
  domainKey: string;
  enabled: boolean;
  viewMode: ViewMode;
  siteRule: SiteRule;
  endpointBaseUrl: string;
  model: string;
  apiKey: string;
  translationStyle: ExtensionSettings["translationStyle"];
}

export const DEFAULT_SETTINGS: ExtensionSettings = {
  siteRules: {},
  xDefaultEnabled: true,
  endpointBaseUrl: "http://127.0.0.1:8000/v1",
  model: "gemma-4-e4b-it-4bit",
  apiKey: "",
  translationStyle: "natural-zh-CN"
};

export const TRANSLATION_SYSTEM_PROMPT = [
  "你是网页翻译助手。",
  "请把用户提供的网页内容翻译成自然、地道、流畅的简体中文。",
  "不要生硬直译，要像中文作者自然写出来的表达。",
  "保留 URL、邮箱、@提及、#标签、emoji、换行、项目符号和列表结构。",
  "不要翻译用户名、站点 UI 标签、时间戳或互动按钮文案。",
  "只输出译文，不要加解释。"
].join("");

export function normalizeEndpointBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getDomainKey(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, "");
}

export function isXHost(host: string): boolean {
  const domain = getDomainKey(host);
  return domain === "x.com" || domain === "twitter.com";
}

export function isHackerNewsHost(host: string): boolean {
  return getDomainKey(host) === "news.ycombinator.com";
}

export function mergeSettings(
  raw: Partial<ExtensionSettings> | undefined
): ExtensionSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    siteRules: {
      ...DEFAULT_SETTINGS.siteRules,
      ...(raw?.siteRules ?? {})
    },
    endpointBaseUrl: normalizeEndpointBaseUrl(
      raw?.endpointBaseUrl ?? DEFAULT_SETTINGS.endpointBaseUrl
    ) || DEFAULT_SETTINGS.endpointBaseUrl,
    apiKey: (raw?.apiKey ?? DEFAULT_SETTINGS.apiKey).trim()
  };
}

export function resolveSiteRule(
  host: string,
  settings: ExtensionSettings
): SiteRule {
  if (isXHost(host) && settings.xDefaultEnabled) {
    return "auto";
  }

  return settings.siteRules[getDomainKey(host)] ?? "off";
}
