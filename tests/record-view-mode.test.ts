import { getRecordViewModeAction } from "../src/content/record-view-mode";

describe("record view mode action", () => {
  it("restores the original view when switching to original mode", () => {
    expect(
      getRecordViewModeAction(
        { status: "done", translatedText: "译文" },
        "original"
      )
    ).toBe("restore-original");
  });

  it("reuses cached translated text when switching back to translated mode", () => {
    expect(
      getRecordViewModeAction(
        { status: "restored", translatedText: "译文" },
        "translated"
      )
    ).toBe("show-cached-translation");
  });

  it("requests requeue when no cached translation is available", () => {
    expect(
      getRecordViewModeAction(
        { status: "restored", translatedText: null },
        "translated"
      )
    ).toBe("queue-translation");
  });
});
