import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import { createBrowserViteConfig } from '../../build/vite.js';
import { localProviderPlugins } from '../providers/local.js';
import { cotProxy } from '../providers/cot.js';
import { apiNotFoundPlugin } from './api-not-found.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

// Guard against Node 24 internal undici TLS socket abortion crashes from external telemetry proxies
if (typeof process !== 'undefined' && !process.__undici_guarded) {
  process.__undici_guarded = true;
  process.on('uncaughtException', (err) => {
    if (
      err?.code === 'ERR_ASSERTION' ||
      err?.message?.includes('!this.paused')
    ) {
      return;
    }
    console.error('[Process uncaughtException]', err);
  });
  process.on('unhandledRejection', (reason) => {
    console.warn('[Process unhandledRejection notice]', reason);
  });
}

/** Load this checkout's configuration and attach its local provider middleware. */
export default defineConfig(({ command, mode }) => {
  const loaded = loadEnv(mode, root, '');
  for (const [key, value] of Object.entries(loaded)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  const plugins = [...localProviderPlugins()];
  if (mode !== 'test') {
    plugins.push(cotProxy());
  }
  plugins.push(apiNotFoundPlugin());
  return createBrowserViteConfig({
    plugins,
    googleApiKey: process.env.GOOGLE_MAPS_API_KEY,
    cesiumToken: process.env.CESIUM_ION_TOKEN,
    host: process.env.HOST,
    port: process.env.PORT,
    command,
  });
});
