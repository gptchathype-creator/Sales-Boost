"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTunnel = startTunnel;
exports.stopTunnel = stopTunnel;
exports.getTunnelUrl = getTunnelUrl;
const config_1 = require("./config");
const child_process_1 = require("child_process");
let tunnelProcess = null;
let tunnelUrl = null;
let tunnelUrlCallback = null;
let restartCount = 0;
const MAX_RESTARTS = 5;
const RESTART_DELAY_MS = 5000;
async function startTunnel(onUrlReceived) {
    if (tunnelUrl) {
        onUrlReceived?.(tunnelUrl);
        return tunnelUrl;
    }
    tunnelUrlCallback = onUrlReceived || null;
    try {
        const port = config_1.config.port;
        console.log('[TUNNEL] Starting localhost.run tunnel on port ' + port + '...');
        const url = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Tunnel timeout (30s)')), 30000);
            const proc = (0, child_process_1.spawn)('ssh', [
                '-o', 'StrictHostKeyChecking=no',
                '-o', 'ServerAliveInterval=60',
                '-o', 'ConnectTimeout=10',
                '-R', `80:localhost:${port}`,
                'nokey@localhost.run',
            ], { stdio: ['ignore', 'pipe', 'pipe'] });
            tunnelProcess = proc;
            let output = '';
            const handleData = (data) => {
                const text = data.toString();
                output += text;
                const match = text.match(/https:\/\/[a-z0-9]+\.lhr\.life/);
                if (match) {
                    clearTimeout(timeout);
                    resolve(match[0]);
                }
            };
            proc.stdout?.on('data', handleData);
            proc.stderr?.on('data', handleData);
            proc.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
            proc.on('exit', (code) => {
                clearTimeout(timeout);
                if (!tunnelUrl) {
                    reject(new Error('SSH exited before URL (code ' + code + '): ' + output.slice(0, 200)));
                }
            });
        });
        tunnelUrl = url;
        restartCount = 0;
        tunnelProcess?.on('exit', (code) => {
            console.log('[TUNNEL] SSH exited, code:', code);
            tunnelProcess = null;
            tunnelUrl = null;
            if (restartCount < MAX_RESTARTS) {
                restartCount++;
                console.log('[TUNNEL] Перезапуск через ' + RESTART_DELAY_MS / 1000 + ' сек...');
                setTimeout(() => {
                    startTunnel(tunnelUrlCallback || undefined).catch(() => { });
                }, RESTART_DELAY_MS);
            }
        });
        console.log('[TUNNEL] ' + tunnelUrl);
        onUrlReceived?.(tunnelUrl);
        return tunnelUrl;
    }
    catch (error) {
        console.error('[TUNNEL] Failed:', error instanceof Error ? error.message : error);
        tunnelProcess = null;
        tunnelUrl = null;
        return null;
    }
}
function stopTunnel() {
    if (tunnelProcess) {
        tunnelProcess.kill();
        tunnelProcess = null;
        tunnelUrl = null;
    }
}
function getTunnelUrl() {
    return tunnelUrl;
}
//# sourceMappingURL=tunnel.js.map