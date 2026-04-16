import { collectDeltaFromSsePayload, createThrottledEmitter } from "../src/background/streaming";

describe("streaming helpers", () => {
  it("extracts text deltas from chat completion payloads", () => {
    const delta = collectDeltaFromSsePayload(
      JSON.stringify({
        choices: [{ delta: { content: "你好" } }]
      })
    );

    expect(delta).toBe("你好");
  });

  it("throttles bursty updates into a single emission window", async () => {
    vi.useFakeTimers();

    const values: string[] = [];
    const emitter = createThrottledEmitter(120, (value) => {
      values.push(value);
    });

    emitter.push("你");
    emitter.push("你好");
    emitter.push("你好，世");
    vi.advanceTimersByTime(119);
    expect(values).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(values).toEqual(["你好，世"]);

    emitter.flush();
    expect(values).toEqual(["你好，世"]);
  });
});
