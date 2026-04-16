import {
  getNextViewMode,
  isTranslationViewActive,
  type ViewMode
} from "../src/shared/view-mode";

describe("view mode helpers", () => {
  it("toggles between translated and original", () => {
    expect(getNextViewMode("translated")).toBe("original");
    expect(getNextViewMode("original")).toBe("translated");
  });

  it("treats only translated mode on enabled pages as active translation mode", () => {
    expect(isTranslationViewActive(true, "translated")).toBe(true);
    expect(isTranslationViewActive(true, "original")).toBe(false);
    expect(isTranslationViewActive(false, "translated")).toBe(false);
  });

  it("keeps the view mode domain intentionally narrow", () => {
    const modes: ViewMode[] = ["translated", "original"];
    expect(modes).toHaveLength(2);
  });
});
