const KATEX_CSS = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
const KATEX_JS = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
const KATEX_AUTO_RENDER_JS = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js";

type IdleRequestCallback = (deadline: { didTimeout: boolean; timeRemaining(): number }) => void;

type IdleRequestScheduler = {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: { timeout?: number }) => number;
};

type KatexWindow = Window & {
  katex?: unknown;
  renderMathInElement?: unknown;
};

let katexLoadPromise: Promise<void> | null = null;
let preloadScheduled = false;

function loadStylesheet(href: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  const existing = document.querySelector<HTMLLinkElement>(`link[data-katex-href="${href}"]`);
  if (existing) {
    if (existing.dataset.loaded === "true" || existing.rel === "stylesheet") {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load stylesheet ${href}`)),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.crossOrigin = "anonymous";
    link.dataset.katexHref = href;
    link.dataset.loaded = "false";
    link.addEventListener(
      "load",
      () => {
        link.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    link.addEventListener(
      "error",
      () => reject(new Error(`Failed to load stylesheet ${href}`)),
      { once: true },
    );
    document.head.appendChild(link);
  });
}

function loadScript(src: string): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(`script[data-katex-src="${src}"]`);
  if (existing) {
    if (existing.dataset.loaded === "true") {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load script ${src}`)),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.crossOrigin = "anonymous";
    script.dataset.katexSrc = src;
    script.dataset.loaded = "false";
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load script ${src}`)),
      { once: true },
    );
    document.head.appendChild(script);
  });
}

export async function ensureKatexAssets(): Promise<void> {
  if (typeof window === "undefined") return;
  const katexWindow = window as KatexWindow;
  if (katexWindow.katex && typeof katexWindow.renderMathInElement === "function") return;

  if (!katexLoadPromise) {
    katexLoadPromise = (async () => {
      await loadStylesheet(KATEX_CSS);
      if (!katexWindow.katex) {
        await loadScript(KATEX_JS);
      }
      if (typeof katexWindow.renderMathInElement !== "function") {
        await loadScript(KATEX_AUTO_RENDER_JS);
      }
    })().catch((error) => {
      katexLoadPromise = null;
      throw error;
    });
  }

  await katexLoadPromise;
}

export function preloadKatexAssets(): void {
  if (typeof window === "undefined") return;
  if (preloadScheduled || katexLoadPromise) return;

  const scheduleLoad = () => {
    ensureKatexAssets().catch((error) => {
      preloadScheduled = false;
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to preload KaTeX assets", error);
      }
    });
  };

  preloadScheduled = true;
  const idleScheduler = window as Window & IdleRequestScheduler;

  if (typeof idleScheduler.requestIdleCallback === "function") {
    idleScheduler.requestIdleCallback(
      () => {
        preloadScheduled = false;
        scheduleLoad();
      },
      { timeout: 2000 },
    );
  } else {
    window.setTimeout(() => {
      preloadScheduled = false;
      scheduleLoad();
    }, 500);
  }
}
