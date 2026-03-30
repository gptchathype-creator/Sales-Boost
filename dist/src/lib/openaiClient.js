"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.openai = void 0;
const openai_1 = __importDefault(require("openai"));
const undici_1 = require("undici");
const config_1 = require("../config");
function createOpenAIClient() {
    const baseOptions = { apiKey: config_1.config.openaiApiKey };
    if (config_1.config.httpsProxy) {
        const proxyAgent = new undici_1.ProxyAgent(config_1.config.httpsProxy);
        const customFetch = (input, init) => (0, undici_1.fetch)(input, { ...init, dispatcher: proxyAgent });
        return new openai_1.default({ ...baseOptions, fetch: customFetch });
    }
    return new openai_1.default(baseOptions);
}
exports.openai = createOpenAIClient();
//# sourceMappingURL=openaiClient.js.map