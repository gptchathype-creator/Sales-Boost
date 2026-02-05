import type { Telegraf, Context } from 'telegraf';
import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { pipeline } from 'stream/promises';

/**
 * Download Telegram voice file to ./tmp and return local filepath.
 */
export async function downloadTelegramVoice(
  bot: Telegraf<Context>,
  fileId: string
): Promise<string> {
  const fileLink = await bot.telegram.getFileLink(fileId);
  const url = new URL(fileLink.toString());

  const tmpDir = path.join(__dirname, '../../tmp');
  await fs.promises.mkdir(tmpDir, { recursive: true });

  // Telegram voice обычно приходит как .oga (OGG/Opus), а OpenAI ожидает расширение .ogg.
  const originalExt = path.extname(url.pathname);
  const ext = originalExt && originalExt.toLowerCase() !== '.oga' ? originalExt : '.ogg';
  const filename = `${Date.now()}-${fileId}${ext}`;
  const filepath = path.join(tmpDir, filename);

  const client = url.protocol === 'https:' ? https : http;

  const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
    const req = client.get(url, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 400) {
        reject(new Error(`Failed to download voice file: HTTP ${status}`));
      } else {
        resolve(res);
      }
    });
    req.on('error', reject);
  });

  const writeStream = fs.createWriteStream(filepath);
  await pipeline(response, writeStream);

  return filepath;
}

