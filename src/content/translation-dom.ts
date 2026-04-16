import { normalizeSourceText } from "../shared/hash";

const ORIGINAL_CLASS = "lt-original";
const TRANSLATED_CLASS = "lt-translated";

function getTranslatedLayer(element: HTMLElement): HTMLElement | null {
  return element.querySelector<HTMLElement>(`.${TRANSLATED_CLASS}`);
}

export function ensureTranslationShell(element: HTMLElement): void {
  if (element.dataset.ltWrapped === "true") {
    return;
  }

  element.dataset.ltOriginalHtml = element.innerHTML;
  element.dataset.ltOriginalText = normalizeSourceText(element.textContent ?? "");
  element.dataset.ltWrapped = "true";
  element.title = element.dataset.ltOriginalText;
  element.classList.add("local-translator-block");

  const originalLayer = element.ownerDocument.createElement("span");
  originalLayer.className = ORIGINAL_CLASS;
  originalLayer.innerHTML = element.dataset.ltOriginalHtml;

  const translatedLayer = element.ownerDocument.createElement("span");
  translatedLayer.className = TRANSLATED_CLASS;
  translatedLayer.setAttribute("aria-hidden", "true");

  element.replaceChildren(originalLayer, translatedLayer);
}

export function updateTranslatedText(
  element: HTMLElement,
  translatedText: string
): void {
  ensureTranslationShell(element);
  if (!element.dataset.ltLockedHeight) {
    const measuredHeight = Math.ceil(element.getBoundingClientRect().height);
    if (measuredHeight > 0) {
      element.dataset.ltLockedHeight = String(measuredHeight);
      element.style.minHeight = `${measuredHeight}px`;
    }
  }
  const translatedLayer = getTranslatedLayer(element);
  if (!translatedLayer) {
    return;
  }
  translatedLayer.textContent = translatedText;
  element.classList.add("has-translation", "is-translating");
  element.classList.remove("lt-failed");
}

export function finalizeTranslatedText(element: HTMLElement): boolean {
  const translatedLayer = getTranslatedLayer(element);
  if (!translatedLayer) {
    return false;
  }

  const translatedText = translatedLayer.textContent ?? "";
  if (!translatedText) {
    return false;
  }

  element.replaceChildren(element.ownerDocument.createTextNode(translatedText));
  element.classList.remove("has-translation", "is-translating", "lt-failed");
  element.classList.add("lt-done");
  element.style.removeProperty("min-height");
  delete element.dataset.ltLockedHeight;

  setTimeout(() => {
    element.classList.remove("lt-done");
  }, 650);
  return true;
}

export function markTranslationFailed(element: HTMLElement): void {
  element.classList.remove("is-translating");
  element.classList.add("lt-failed");
}

export function restoreOriginalText(element: HTMLElement): void {
  const originalHtml = element.dataset.ltOriginalHtml;
  if (!originalHtml) {
    return;
  }

  element.innerHTML = originalHtml;
  element.classList.remove(
    "local-translator-block",
    "has-translation",
    "is-translating",
    "lt-failed",
    "lt-done"
  );
  element.style.removeProperty("min-height");
  delete element.dataset.ltLockedHeight;
  delete element.dataset.ltWrapped;
  delete element.dataset.ltOriginalHtml;
  delete element.dataset.ltOriginalText;
}

export function resetTranslatedState(element: HTMLElement): void {
  element.classList.remove("has-translation", "is-translating", "lt-failed", "lt-done");
  if (element.dataset.ltWrapped === "true") {
    restoreOriginalText(element);
    ensureTranslationShell(element);
  }
}
