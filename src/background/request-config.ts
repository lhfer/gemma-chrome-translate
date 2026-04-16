export function buildOpenAIHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  const normalized = apiKey.trim();
  if (normalized) {
    headers.Authorization = `Bearer ${normalized}`;
  }

  return headers;
}

export function normalizeConfiguredModelId(model: string): string {
  const normalized = model.trim();
  if (!normalized) {
    return normalized;
  }

  return normalized.includes("/")
    ? normalized.split("/").filter(Boolean).pop() ?? normalized
    : normalized;
}
