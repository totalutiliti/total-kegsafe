/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist, StaleWhileRevalidate, ExpirationPlugin } from 'serwist';

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    ...defaultCache,
    // Cache barrel list for offline read
    {
      matcher: ({ url }) => /\/api\/v1\/barrels(\?.*)?$/.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: 'api-barrels',
        plugins: [
          new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 }),
        ],
      }),
    },
    // Cache client list for offline read
    {
      matcher: ({ url }) => /\/api\/v1\/clients(\?.*)?$/.test(url.pathname),
      handler: new StaleWhileRevalidate({
        cacheName: 'api-clients',
        plugins: [
          new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 }),
        ],
      }),
    },
  ],
});

serwist.addEventListeners();
