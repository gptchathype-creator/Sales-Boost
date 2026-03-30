"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
const crypto_1 = __importDefault(require("crypto"));
const SCRYPT_KEYLEN = 64;
function hashPassword(password) {
    const salt = crypto_1.default.randomBytes(16).toString('hex');
    const derived = crypto_1.default.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
    return `scrypt$${salt}$${derived}`;
}
function verifyPassword(password, encoded) {
    const [scheme, salt, expected] = encoded.split('$');
    if (scheme !== 'scrypt' || !salt || !expected)
        return false;
    const actual = crypto_1.default.scryptSync(password, salt, SCRYPT_KEYLEN);
    const expectedBuf = Buffer.from(expected, 'hex');
    if (actual.length !== expectedBuf.length)
        return false;
    return crypto_1.default.timingSafeEqual(actual, expectedBuf);
}
//# sourceMappingURL=password.js.map