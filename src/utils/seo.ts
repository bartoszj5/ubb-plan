export const SITE_URL = 'https://ubbplan.vercel.app';
export const DEFAULT_TITLE = 'Plan Zajęć UBB - Uniwersytet Bielsko-Bialski';
export const DEFAULT_DESCRIPTION = 'Plan zajęć Uniwersytetu Bielsko-Bialskiego w wygodnej aplikacji do szybkiego wyszukiwania grup, kierunków i harmonogramów.';

function upsertHead(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) { el = create(); document.head.appendChild(el); }
  el.setAttribute(attr, value);
}

function meta(key: 'name' | 'property', name: string, content: string) {
  upsertHead(`meta[${key}="${name}"]`, () => { const m = document.createElement('meta'); m.setAttribute(key, name); return m; }, 'content', content);
}

/** Keeps the title, description and canonical URL specific to the page a crawler or visitor is on. */
export function setPageMeta({ title, description, path }: { title: string; description: string; path: string }) {
  const url = `${SITE_URL}${path}`;
  document.title = title;
  meta('name', 'description', description);
  meta('property', 'og:title', title);
  meta('property', 'og:description', description);
  meta('property', 'og:url', url);
  upsertHead('link[rel="canonical"]', () => { const l = document.createElement('link'); l.rel = 'canonical'; return l; }, 'href', url);
}
