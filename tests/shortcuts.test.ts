import {
  createShortcutState,
  handleTranslationShortcutEvent
} from "../src/content/shortcuts";

describe("shortcut helpers", () => {
  it("toggles when right command is pressed and released alone", () => {
    const state = createShortcutState();

    const keydownEvent = {
      type: "keydown",
      key: "Meta",
      code: "MetaRight",
      altKey: false,
      shiftKey: false,
      metaKey: true,
      ctrlKey: false,
      isComposing: false,
      target: document.body
    };
    const keyupEvent = {
      ...keydownEvent,
      type: "keyup",
      metaKey: false
    };

    expect(handleTranslationShortcutEvent(state, keydownEvent)).toBe(false);
    expect(handleTranslationShortcutEvent(state, keyupEvent)).toBe(true);
  });

  it("does not toggle when right command was used with another key", () => {
    const state = createShortcutState();

    handleTranslationShortcutEvent(state, {
      type: "keydown",
      key: "Meta",
      code: "MetaRight",
      altKey: false,
      shiftKey: false,
      metaKey: true,
      ctrlKey: false,
      isComposing: false,
      target: document.body
    });

    handleTranslationShortcutEvent(state, {
      type: "keydown",
      key: "c",
      code: "KeyC",
      altKey: false,
      shiftKey: false,
      metaKey: true,
      ctrlKey: false,
      isComposing: false,
      target: document.body
    });

    expect(
      handleTranslationShortcutEvent(state, {
        type: "keyup",
        key: "Meta",
        code: "MetaRight",
        altKey: false,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        isComposing: false,
        target: document.body
      })
    ).toBe(false);
  });

  it("ignores the shortcut while typing into editable controls", () => {
    const state = createShortcutState();
    const input = document.createElement("input");

    expect(
      handleTranslationShortcutEvent(state, {
        type: "keydown",
        key: "Meta",
        code: "MetaRight",
        altKey: false,
        shiftKey: false,
        metaKey: true,
        ctrlKey: false,
        isComposing: false,
        target: input
      })
    ).toBe(false);
  });

  it("ignores left command", () => {
    const state = createShortcutState();

    const event = {
      type: "keydown",
      key: "Meta",
      code: "MetaLeft",
      altKey: false,
      shiftKey: false,
      metaKey: true,
      ctrlKey: false,
      isComposing: false,
      target: document.body
    };

    expect(handleTranslationShortcutEvent(state, event)).toBe(false);
  });
});
