import crypto from 'crypto';

export type AuthTokenPayload = {
  sub: string;
  email: string;
  exp: number;
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function unbase64url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64').toString('utf8');
}

function sign(data: string, secret: string): string {
  return base64url(crypto.createHmac('sha256', secret).update(data).digest());
}

export function createAuthToken(
  payload: Omit<AuthTokenPayload, 'exp'> & { ttlSec?: number },
  secret: string,
): string {
  const body: AuthTokenPayload = {
    sub: payload.sub,
    email: payload.email,
    exp: Math.floor(Date.now() / 1000) + (payload.ttlSec ?? 60 * 60 * 24 * 7),
  };
  const encoded = base64url(JSON.stringify(body));
  const signature = sign(encoded, secret);
  return `${encoded}.${signature}`;
}

export function verifyAuthToken(token: string, secret: string): AuthTokenPayload | null {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) return null;
  const expected = sign(encoded, secret);
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length) return null;
  if (!crypto.timingSafeEqual(expectedBuf, signatureBuf)) return null;

  try {
    const payload = JSON.parse(unbase64url(encoded)) as AuthTokenPayload;
    if (!payload.sub || !payload.email || !payload.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
