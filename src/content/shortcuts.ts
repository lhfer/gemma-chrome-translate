export interface ShortcutState {
  pendingMetaRightTap: boolean;
}

type ShortcutKeyboardEvent = Pick<
  KeyboardEvent,
  | "type"
  | "key"
  | "code"
  | "altKey"
  | "shiftKey"
  | "metaKey"
  | "ctrlKey"
  | "isComposing"
  | "target"
>;

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest("input, textarea, [contenteditable='true'], [role='textbox']")
  );
}

export function createShortcutState(): ShortcutState {
  return {
    pendingMetaRightTap: false
  };
}

export function handleTranslationShortcutEvent(
  state: ShortcutState,
  event: ShortcutKeyboardEvent
): boolean {
  if (event.isComposing || isEditableTarget(event.target)) {
    state.pendingMetaRightTap = false;
    return false;
  }

  if (event.type === "keydown") {
    if (
      event.code === "MetaRight" &&
      !event.altKey &&
      !event.shiftKey &&
      !event.ctrlKey
    ) {
      state.pendingMetaRightTap = true;
      return false;
    }

    if (state.pendingMetaRightTap && event.code !== "MetaRight") {
      state.pendingMetaRightTap = false;
    }

    return false;
  }

  if (event.type === "keyup") {
    const shouldToggle = state.pendingMetaRightTap && event.code === "MetaRight";
    state.pendingMetaRightTap = false;
    return shouldToggle;
  }

  return false;
}
