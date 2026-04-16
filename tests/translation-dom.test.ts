import { JSDOM } from "jsdom";
import {
  ensureTranslationShell,
  finalizeTranslatedText,
  restoreOriginalText,
  updateTranslatedText
} from "../src/content/translation-dom";

describe("translation dom", () => {
  it("stores original text and replaces it with translated content", () => {
    const dom = new JSDOM(`<p id="target">Original source text.</p>`);
    const element = dom.window.document.getElementById("target") as HTMLElement;

    ensureTranslationShell(element);
    updateTranslatedText(element, "翻译后的中文");

    expect(element.dataset.ltOriginalText).toBe("Original source text.");
    expect(element.textContent).toContain("翻译后的中文");
    expect(element.title).toBe("Original source text.");
  });

  it("restores the source text after translation", () => {
    const dom = new JSDOM(`<p id="target">Original source text.</p>`);
    const element = dom.window.document.getElementById("target") as HTMLElement;

    ensureTranslationShell(element);
    updateTranslatedText(element, "翻译后的中文");
    restoreOriginalText(element);

    expect(element.textContent).toBe("Original source text.");
  });

  it("collapses to translated-only layout after streaming completes", () => {
    const dom = new JSDOM(`<p id="target"><span>Original source text.</span></p>`, {
      url: "https://example.com"
    });
    const element = dom.window.document.getElementById("target") as HTMLElement;

    ensureTranslationShell(element);
    updateTranslatedText(element, "翻译后的中文");
    finalizeTranslatedText(element);

    expect(element.querySelector(".lt-original")).toBeNull();
    expect(element.querySelector(".lt-translated")).toBeNull();
    expect(element.textContent).toBe("翻译后的中文");
    expect(element.title).toBe("Original source text.");
  });
});
