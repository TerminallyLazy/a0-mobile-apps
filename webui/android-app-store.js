import { createStore } from '/js/AlpineStore.js';
import { callJsonApi } from '/js/api.js';
import { toastFrontendError } from '/components/notifications/notification-store.js';
import { APK_URL, IOS_BETA_URL, parseOrigin, installLink, appLink } from './connection.mjs';

function phoneOrigin(value) {
  const origin = parseOrigin(value);
  if (!origin) return null;
  const host = new URL(origin).hostname;
  return /^(localhost|127\..*|\[::1\]|0\.0\.0\.0)$/i.test(host) ? null : origin;
}

export const store = createStore('mobileAppsStore', {
  createModel() {
    return {
      server: '', loading: true, disposed: false,
      apk: APK_URL, iosBeta: IOS_BETA_URL,
      get installUrl() { return installLink(this.server); },
      get openUrl() { return appLink(this.server, /Android/i.test(navigator.userAgent)); },
      async onOpen(element) {
        this.server = phoneOrigin(location.origin) || '';
        const initialServer = this.server;
        // Downloads do not depend on a tunnel lookup finishing.
        this.drawCode(element.querySelector('[data-mobile-qr="install"]'), this.installUrl);
        this.drawCode(element.querySelector('[data-mobile-qr="ios"]'), this.iosBeta);
        try {
          if (!this.server) {
            const status = await callJsonApi('tunnel_proxy', { action: 'get' });
            if (this.disposed) return;
            this.server = status.success ? phoneOrigin(status.tunnel_url) || '' : '';
          }
        } catch {
          if (!this.disposed) toastFrontendError('Could not check the HTTPS connection. You can still download the app and enter your address manually.', 'Mobile Apps');
        } finally {
          if (!this.disposed) {
            this.loading = false;
            if (this.server !== initialServer) this.drawCode(element.querySelector('[data-mobile-qr="install"]'), this.installUrl);
            if (this.server) this.drawCode(element.querySelector('[data-mobile-qr="connect"]'), this.server);
          }
        }
      },
      drawCode(element, text) {
        if (!element) return;
        element.replaceChildren();
        try {
          new globalThis.QRCode(element, { text, width: 160, height: 160, colorDark: '#101817', colorLight: '#ffffff', correctLevel: globalThis.QRCode.CorrectLevel.M });
          element.removeAttribute('title');
        } catch {
          toastFrontendError('QR code could not be drawn. Use the download and server address links instead.', 'Mobile Apps');
        }
      },
      cleanup() { this.disposed = true; this.server = ''; },
    };
  },
});
