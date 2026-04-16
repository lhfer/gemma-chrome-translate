type QueueableRecord<T extends HTMLElement = HTMLElement> = {
  element: T;
  status: string;
};

export function isElementWithinQueueViewport(
  element: HTMLElement,
  viewportHeight: number,
  viewportMargin = 320
): boolean {
  const rect = element.getBoundingClientRect();
  return rect.bottom >= -viewportMargin && rect.top <= viewportHeight + viewportMargin;
}

export function getImmediateQueueCandidates<T extends QueueableRecord>(
  records: T[],
  viewportHeight: number,
  viewportMargin = 320
): T[] {
  return records.filter(
    (record) =>
      record.status === "idle" &&
      isElementWithinQueueViewport(record.element, viewportHeight, viewportMargin)
  );
}
