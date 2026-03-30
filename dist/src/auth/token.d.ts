export type AuthTokenPayload = {
    sub: string;
    email: string;
    exp: number;
};
export declare function createAuthToken(payload: Omit<AuthTokenPayload, 'exp'> & {
    ttlSec?: number;
}, secret: string): string;
export declare function verifyAuthToken(token: string, secret: string): AuthTokenPayload | null;
//# sourceMappingURL=token.d.ts.map