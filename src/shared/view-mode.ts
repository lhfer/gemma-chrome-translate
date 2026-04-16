export type ViewMode = "translated" | "original";

export function getNextViewMode(current: ViewMode): ViewMode {
  return current === "translated" ? "original" : "translated";
}

export function isTranslationViewActive(
  enabled: boolean,
  viewMode: ViewMode
): boolean {
  return enabled && viewMode === "translated";
}
