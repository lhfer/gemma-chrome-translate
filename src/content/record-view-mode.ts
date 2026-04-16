import type { BlockStatus } from "../shared/messages";
import type { ViewMode } from "../shared/view-mode";

export type RecordViewModeAction =
  | "restore-original"
  | "show-cached-translation"
  | "queue-translation"
  | "noop";

export function getRecordViewModeAction(
  record: {
    status: BlockStatus;
    translatedText: string | null;
  },
  viewMode: ViewMode
): RecordViewModeAction {
  if (viewMode === "original") {
    return "restore-original";
  }

  if (record.translatedText) {
    return "show-cached-translation";
  }

  if (record.status === "restored" || record.status === "failed") {
    return "queue-translation";
  }

  return "noop";
}
