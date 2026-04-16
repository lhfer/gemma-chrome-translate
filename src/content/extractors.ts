import { normalizeSourceText } from "../shared/hash";

export interface CandidateBlock {
  element: HTMLElement;
  text: string;
}

const SEMANTIC_SELECTOR = "p, li, h1, h2, h3, h4, h5, h6, blockquote, td, th, figcaption, dt, dd";
const SKIP_SELECTOR = [
  "input",
  "textarea",
  "[contenteditable='true']",
  "button",
  "nav",
  "aside",
  "menu",
  "code",
  "pre",
  "script",
  "style",
  "svg",
  "img",
  "video",
  "audio",
  "canvas",
  "iframe",
  "noscript",
  "label",
  "select",
  "option",
  "[role='navigation']",
  "[role='toolbar']",
  "[role='tablist']",
  "[role='tab']",
  "[role='banner']",
  "[role='complementary']",
  "[role='menubar']",
  "[role='menu']",
  "[role='menuitem']",
  "[role='button']",
  "[role='search']",
  "[role='alert']",
  "[role='status']",
  "[role='tooltip']",
  "[aria-label]"
].join(", ");

// When no semantic root (<main>, <article>) exists, only extract these
// high-confidence content tags to avoid grabbing navigation/UI
const FALLBACK_SELECTOR = "p, blockquote";

const X_LONGFORM_SKIP_SELECTOR = [
  "[data-testid='User-Name']",
  "[data-testid='socialContext']",
  "[data-testid='placementTracking']",
  "[data-testid='like']",
  "[data-testid='retweet']",
  "[data-testid='reply']",
  "[data-testid='bookmark']",
  "[data-testid='viewCount']",
  "button",
  "time",
  "nav"
].join(", ");

function isHidden(element: HTMLElement): boolean {
  if (element.hidden) {
    return true;
  }

  if (element.closest("[aria-hidden='true']")) {
    return true;
  }

  const style = element.ownerDocument.defaultView?.getComputedStyle(element);
  return style?.display === "none" || style?.visibility === "hidden";
}

function isCjkDominant(text: string): boolean {
  const cjk = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return cjk > 0 && cjk >= latin;
}

function shouldSkipElement(
  element: HTMLElement,
  text: string,
  options?: {
    allowSkippedAncestors?: boolean;
  }
): boolean {
  if (!text || text.length < 5) {
    return true;
  }

  if (isHidden(element)) {
    return true;
  }

  if (!options?.allowSkippedAncestors && element.closest(SKIP_SELECTOR)) {
    return true;
  }

  if (isCjkDominant(text)) {
    return true;
  }

  return false;
}

function isLikelyXSidebarMeta(text: string): boolean {
  return (
    /^\d+(?:\.\d+)?\s*[kKmM]?\s+posts?$/i.test(text) ||
    /^\d+\s+(?:minutes?|hours?|days?)\s+ago$/i.test(text) ||
    /^\d+\s+(?:minutes?|hours?|days?)\s+ago\s+·\s+.+$/i.test(text) ||
    /^(?:news|sports|entertainment|technology|politics)\s*(?:·\s*trending)?$/i.test(
      text
    ) ||
    /^(?:promoted by|live on x)$/i.test(text)
  );
}

function isLikelyXLongformMeta(text: string): boolean {
  return (
    /^@\w+/i.test(text) ||
    /^\d+(?:\.\d+)?\s*[kKmM]?$/i.test(text) ||
    /^(?:translate post|show more|show less)$/i.test(text) ||
    /^(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\s+\d{1,2}$/i.test(text)
  );
}

function collectBlocks(
  elements: Iterable<HTMLElement>,
  options?: {
    allowSkippedAncestors?: boolean;
  }
): CandidateBlock[] {
  const blocks: CandidateBlock[] = [];

  for (const element of elements) {
    const text = normalizeSourceText(
      element.dataset.ltOriginalText ?? element.textContent ?? ""
    );

    if (shouldSkipElement(element, text, options)) {
      continue;
    }

    blocks.push({ element, text });
  }

  return blocks;
}

export function extractGenericBlocks(document: Document): CandidateBlock[] {
  const semanticRoots = Array.from(
    document.querySelectorAll<HTMLElement>("main, article, [role='main']")
  );

  const elements = new Set<HTMLElement>();

  if (semanticRoots.length > 0) {
    // Scoped mode: semantic roots exist, search full selector within them
    for (const root of semanticRoots) {
      root
        .querySelectorAll<HTMLElement>(SEMANTIC_SELECTOR)
        .forEach((el) => elements.add(el));
    }
  } else {
    // Fallback mode: no semantic roots — only extract high-confidence
    // content tags (p, blockquote) to avoid grabbing navigation/UI
    document.body
      .querySelectorAll<HTMLElement>(FALLBACK_SELECTOR)
      .forEach((el) => elements.add(el));
  }

  return collectBlocks(elements);
}

export function extractXBlocks(document: Document): CandidateBlock[] {
  const elements = new Set<HTMLElement>();

  document
    .querySelectorAll<HTMLElement>(
      "article [data-testid='tweetText'], article [data-testid='postText']"
    )
    .forEach((element) => elements.add(element));

  for (const article of document.querySelectorAll<HTMLElement>("main article, article")) {
    const candidates = article.querySelectorAll<HTMLElement>(
      "div[dir='auto'], div[dir='ltr'], span[dir='auto'], span[dir='ltr']"
    );

    for (const element of candidates) {
      if (
        element.closest("[data-testid='tweetText']") ||
        element.closest("[data-testid='postText']")
      ) {
        continue;
      }

      if (element.closest(X_LONGFORM_SKIP_SELECTOR)) {
        continue;
      }

      const text = normalizeSourceText(element.textContent ?? "");
      if (!text || text.length < 10 || isLikelyXLongformMeta(text)) {
        continue;
      }

      const qualifyingChildren = Array.from(
        element.querySelectorAll<HTMLElement>(
          "div[dir='auto'], div[dir='ltr'], span[dir='auto'], span[dir='ltr']"
        )
      ).filter((child) => {
        if (child === element || child.closest(X_LONGFORM_SKIP_SELECTOR)) {
          return false;
        }
        return normalizeSourceText(child.textContent ?? "").length >= 10;
      });

      if (qualifyingChildren.length === 0) {
        elements.add(element);
      } else {
        for (const child of qualifyingChildren) {
          elements.add(child);
        }
      }
    }
  }

  const sidebarRoots = ["aside", "[data-testid='sidebarColumn']", "[data-testid='SidebarColumn']"];
  const sidebarLeaves = [
    "section [role='heading'] span",
    "[data-testid='trend'] span",
    "[data-testid='trend'] div[dir='ltr']",
    "[data-testid='trend'] div[dir='auto']",
    "[data-testid='trend'] a[dir='auto']",
    "section h2 span",
    "section a span",
    "section a div[dir='ltr']",
    "section a div[dir='auto']",
    "[data-testid='card.wrapper'] div[dir='auto']",
    "[data-testid='card.wrapper'] div[dir='ltr']",
    "[data-testid='card.wrapper'] span[dir='auto']",
    "[data-testid='card.wrapper'] span[dir='ltr']",
    "[data-testid='card.wrapper'] [data-testid='card.layoutLarge.detail'] span",
    "[data-testid='card.wrapper'] [data-testid='card.layoutSmall.detail'] span"
  ];
  const sidebarSelector = sidebarRoots
    .flatMap((root) => sidebarLeaves.map((leaf) => `${root} ${leaf}`))
    .join(", ");

  document
    .querySelectorAll<HTMLElement>(sidebarSelector)
    .forEach((element) => {
      const text = normalizeSourceText(element.textContent ?? "");
      if (isLikelyXSidebarMeta(text)) {
        return;
      }
      elements.add(element);
    });

  return collectBlocks(elements, {
    allowSkippedAncestors: true
  });
}

export function extractHackerNewsBlocks(document: Document): CandidateBlock[] {
  const elements = document.querySelectorAll<HTMLElement>(
    "span.titleline > a, span.commtext"
  );

  return collectBlocks(elements);
}
