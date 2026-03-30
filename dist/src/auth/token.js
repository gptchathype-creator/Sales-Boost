"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthToken = createAuthToken;
exports.verifyAuthToken = verifyAuthToken;
const crypto_1 = __importDefault(require("crypto"));
function base64url(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}
function unbase64url(input) {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(normalized + pad, 'base64').toString('utf8');
}
function sign(data, secret) {
    return base64url(crypto_1.default.createHmac('sha256', secret).update(data).digest());
}
function createAuthToken(payload, secret) {
    const body = {
        sub: payload.sub,
        email: payload.email,
        exp: Math.floor(Date.now() / 1000) + (payload.ttlSec ?? 60 * 60 * 24 * 7),
    };
    const encoded = base64url(JSON.stringify(body));
    const signature = sign(encoded, secret);
    return `${encoded}.${signature}`;
}
function verifyAuthToken(token, secret) {
    const [encoded, signature] = token.split('.');
    if (!encoded || !signature)
        return null;
    const expected = sign(encoded, secret);
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (expectedBuf.length !== signatureBuf.length)
        return null;
    if (!crypto_1.default.timingSafeEqual(expectedBuf, signatureBuf))
        return null;
    try {
        const payload = JSON.parse(unbase64url(encoded));
        if (!payload.sub || !payload.email || !payload.exp)
            return null;
        if (payload.exp < Math.floor(Date.now() / 1000))
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=token.js.map