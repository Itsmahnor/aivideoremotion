/**
 * Loads a Google Font stylesheet so the typography preview in the browser matches the font the video uses.
 * Only names from the video package's supported list are requested.
 */
const requested = new Set<string>();

export const ensurePreviewFont = (name: string, supported: readonly string[]) => {
  if (!supported.includes(name) || requested.has(name) || typeof document === 'undefined') return;
  requested.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@400;600;700;800&display=swap`;
  document.head.appendChild(link);
};

export const fontStack = (name: string) => `"${name}", system-ui, sans-serif`;
