type EmitFn = (value: string) => void;

export function collectDeltaFromSsePayload(payload: string): string {
  const parsed = JSON.parse(payload) as {
    choices?: Array<{
      delta?: {
        content?: string | Array<{ text?: string; type?: string }>;
      };
    }>;
  };

  const content = parsed.choices?.[0]?.delta?.content;
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text ?? "")
      .join("");
  }

  return "";
}

export function createThrottledEmitter(delayMs: number, emit: EmitFn) {
  let latest = "";
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    if (!latest) {
      return;
    }

    emit(latest);
    latest = "";
    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }
  };

  return {
    push(value: string) {
      latest = value;
      if (!timer) {
        timer = setTimeout(() => {
          timer = undefined;
          flush();
        }, delayMs);
      }
    },
    flush,
    cancel() {
      latest = "";
      if (timer) {
        clearTimeout(timer);
        timer = undefined;
      }
    }
  };
}
