export const INSTALL_URL = 'https://terminallylazy.github.io/a0-android/';
export const APK_URL = 'https://github.com/TerminallyLazy/a0-android/releases/latest/download/AgentZero.apk';

export function parseOrigin(raw) {
  if (typeof raw !== 'string') return null;
  const text = raw.trim();
  if (text.length > 2048 || !/^https:\/\/[^/?#]+\/?$/i.test(text) || /[^\x21-\x7e]|[%\\@]/.test(text)) return null;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/'
      ? url.origin : null;
  } catch { return null; }
}

export function installLink(server) {
  const origin = parseOrigin(server);
  // Fragments stay in the browser. Hosting and download services never receive the server address.
  return origin ? `${INSTALL_URL}#server=${encodeURIComponent(origin)}` : INSTALL_URL;
}

export function appLink(server, android = false) {
  const origin = parseOrigin(server);
  if (!origin) return null;
  const query = `connect?server=${encodeURIComponent(origin)}`;
  return android
    ? `intent://${query}#Intent;scheme=a0android;package=com.terminallylazy.a0android;S.browser_fallback_url=${encodeURIComponent(installLink(origin))};end`
    : `a0android://${query}`;
}

export function serverFromFragment(fragment) {
  if (fragment.length > 8192 || !fragment.startsWith('#server=') || fragment.includes('&')) return null;
  try { return parseOrigin(decodeURIComponent(fragment.slice(8))); } catch { return null; }
}
