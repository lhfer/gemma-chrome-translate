const WHITESPACE_RE = /[^\S\n]+/g;

export function normalizeSourceText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim().replace(WHITESPACE_RE, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function createSourceHash(input: string): Promise<string> {
  const normalized = normalizeSourceText(input);
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}
