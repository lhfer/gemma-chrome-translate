import {
  getImmediateQueueCandidates,
  isElementWithinQueueViewport
} from "../src/content/visibility";

describe("visibility helpers", () => {
  it("treats elements in or near the viewport as queueable", () => {
    const element = document.createElement("div");
    element.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 200,
        left: 0,
        right: 0,
        width: 0,
        height: 100,
        x: 0,
        y: 100,
        toJSON() {
          return {};
        }
      }) as DOMRect;

    expect(isElementWithinQueueViewport(element, 800, 320)).toBe(true);
  });

  it("selects only visible idle records for immediate requeue", () => {
    const visible = document.createElement("div");
    visible.getBoundingClientRect = () =>
      ({
        top: 50,
        bottom: 120,
        left: 0,
        right: 0,
        width: 0,
        height: 70,
        x: 0,
        y: 50,
        toJSON() {
          return {};
        }
      }) as DOMRect;

    const farAway = document.createElement("div");
    farAway.getBoundingClientRect = () =>
      ({
        top: 4000,
        bottom: 4100,
        left: 0,
        right: 0,
        width: 0,
        height: 100,
        x: 0,
        y: 4000,
        toJSON() {
          return {};
        }
      }) as DOMRect;

    const records = [
      { element: visible, status: "idle" as const },
      { element: farAway, status: "idle" as const },
      { element: visible, status: "done" as const }
    ];

    expect(getImmediateQueueCandidates(records, 800)).toEqual([records[0]]);
  });
});
