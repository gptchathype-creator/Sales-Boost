"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const env_1 = require("./config/env");
exports.config = {
    botToken: env_1.env.botToken,
    openaiApiKey: env_1.env.openaiApiKey,
    // Support both IDs and usernames (with or without @)
    adminIdentifiers: env_1.env.adminIdentifiers,
    databaseUrl: env_1.env.databaseUrl,
    port: env_1.env.port,
    // Allow admin panel in browser on localhost without Telegram initData (dev only)
    allowDevAdmin: env_1.env.allowDevAdmin,
    // Default to HTTPS for localhost if certificates exist, otherwise HTTP
    miniAppUrl: env_1.env.miniAppUrl ||
        (() => {
            const certPath = path_1.default.join(__dirname, '../cert.pem');
            const keyPath = path_1.default.join(__dirname, '../key.pem');
            if (fs_1.default.existsSync(certPath) && fs_1.default.existsSync(keyPath)) {
                return `https://localhost:${env_1.env.port}`;
            }
            return `http://localhost:${env_1.env.port}`;
        })(),
    elevenLabsApiKey: env_1.env.elevenLabsApiKey,
    elevenLabsVoiceId: env_1.env.elevenLabsVoiceId,
    ttsProvider: env_1.env.ttsProvider,
    httpsProxy: env_1.env.httpsProxy,
    authTokenSecret: env_1.env.authTokenSecret,
};
//# sourceMappingURL=config.js.map