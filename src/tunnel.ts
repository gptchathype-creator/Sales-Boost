import { config } from './config';
import { Tunnel } from 'cloudflared';

let tunnelInstance: InstanceType<typeof Tunnel> | null = null;
let tunnelUrl: string | null = null;
let tunnelUrlCallback: ((url: string) => void) | null = null;
let restartCount = 0;
const MAX_RESTARTS = 5;
const RESTART_DELAY_MS = 5000;

/**
 * Start tunnel using cloudflared (trycloudflare.com).
 * No password screen — content is served directly (unlike localtunnel/loca.lt).
 * Auto-restarts when tunnel exits (e.g. 530).
 */
export async function startTunnel(onUrlReceived?: (url: string) => void): Promise<string | null> {
  if (tunnelUrl) {
    onUrlReceived?.(tunnelUrl);
    return tunnelUrl;
  }

  tunnelUrlCallback = onUrlReceived || null;

  try {
    const target = 'http://localhost:' + config.port;
    console.log('[TUNNEL] Starting cloudflared (trycloudflare.com)...');

    const tunnel = Tunnel.quick(target);
    tunnelInstance = tunnel;

    const url = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Tunnel timeout (60s)')), 60000);
      const onUrl = (u: string) => {
        const clean = (u || '').replace(/\/+$/, '');
        // Reject api.trycloudflare.com — we need the actual tunnel subdomain
        if (clean && !clean.includes('api.trycloudflare.com')) {
          clearTimeout(timeout);
          tunnel.off('url', onUrl);
          resolve(clean);
        }
      };
      tunnel.on('url', onUrl);
      tunnel.once('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    tunnelUrl = url;
    restartCount = 0;

    tunnel.on('exit', (code: number | null) => {
      console.log('[TUNNEL] Process exited, code:', code);
      tunnelInstance = null;
      tunnelUrl = null;
      if (restartCount < MAX_RESTARTS) {
        restartCount++;
        console.log('[TUNNEL] Перезапуск через ' + RESTART_DELAY_MS / 1000 + ' сек...');
        setTimeout(() => {
          startTunnel(tunnelUrlCallback || undefined).catch(() => {});
        }, RESTART_DELAY_MS);
      }
    });

    console.log('[TUNNEL] ' + tunnelUrl);
    onUrlReceived?.(tunnelUrl);

    return tunnelUrl;
  } catch (error) {
    console.error('[TUNNEL] Failed:', error instanceof Error ? error.message : error);
    tunnelInstance = null;
    tunnelUrl = null;
    return null;
  }
}

export function stopTunnel() {
  if (tunnelInstance) {
    tunnelInstance.stop();
    tunnelInstance = null;
    tunnelUrl = null;
  }
}

export function getTunnelUrl(): string | null {
  return tunnelUrl;
}
