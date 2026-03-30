"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadTelegramVoice = downloadTelegramVoice;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const promises_1 = require("stream/promises");
/**
 * Download Telegram voice file to ./tmp and return local filepath.
 */
async function downloadTelegramVoice(bot, fileId) {
    const fileLink = await bot.telegram.getFileLink(fileId);
    const url = new URL(fileLink.toString());
    const tmpDir = path_1.default.join(__dirname, '../../tmp');
    await fs_1.default.promises.mkdir(tmpDir, { recursive: true });
    // Telegram voice обычно приходит как .oga (OGG/Opus), а OpenAI ожидает расширение .ogg.
    const originalExt = path_1.default.extname(url.pathname);
    const ext = originalExt && originalExt.toLowerCase() !== '.oga' ? originalExt : '.ogg';
    const filename = `${Date.now()}-${fileId}${ext}`;
    const filepath = path_1.default.join(tmpDir, filename);
    const client = url.protocol === 'https:' ? https_1.default : http_1.default;
    const response = await new Promise((resolve, reject) => {
        const req = client.get(url, (res) => {
            const status = res.statusCode ?? 0;
            if (status >= 400) {
                reject(new Error(`Failed to download voice file: HTTP ${status}`));
            }
            else {
                resolve(res);
            }
        });
        req.on('error', reject);
    });
    const writeStream = fs_1.default.createWriteStream(filepath);
    await (0, promises_1.pipeline)(response, writeStream);
    return filepath;
}
//# sourceMappingURL=telegramDownload.js.map