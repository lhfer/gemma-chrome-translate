import { createSourceHash, normalizeSourceText } from "../src/shared/hash";

describe("hash helpers", () => {
  it("normalizes repeated whitespace while preserving line breaks", () => {
    expect(normalizeSourceText(" Hello   world \n\n  again ")).toBe("Hello world\n\nagain");
  });

  it("creates stable hashes for equivalent normalized text", async () => {
    const first = await createSourceHash("Hello   world");
    const second = await createSourceHash("Hello world");

    expect(first).toBe(second);
    expect(first).toHaveLength(16);
  });
});
