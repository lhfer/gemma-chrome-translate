import {
  buildOpenAIHeaders,
  normalizeConfiguredModelId
} from "../src/background/request-config";

describe("request config helpers", () => {
  it("adds a bearer authorization header when an api key is present", () => {
    expect(buildOpenAIHeaders("1116")).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer 1116"
    });
  });

  it("omits authorization when the api key is blank", () => {
    expect(buildOpenAIHeaders("")).toEqual({
      "Content-Type": "application/json"
    });
  });

  it("normalizes hugging face style model ids to local omlx model ids", () => {
    expect(normalizeConfiguredModelId("mlx-community/gemma-4-e4b-it-4bit")).toBe(
      "gemma-4-e4b-it-4bit"
    );
    expect(normalizeConfiguredModelId("gemma-4-e4b-it-4bit")).toBe(
      "gemma-4-e4b-it-4bit"
    );
  });
});
