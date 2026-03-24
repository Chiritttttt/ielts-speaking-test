import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'ielts-speaking-secret-key-change-in-production';
const COOKIE_NAME = 'auth_token';

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export async function verifyPassword(password: string, storedPassword: string): Promise<boolean> {
  const [salt, hash] = storedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

export function generateToken(userId: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ 
    userId, 
    iat: Date.now(),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000
  })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
  
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string): string | null {
  try {
    const [header, payload, signature] = token.split('.');
    
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
    
    if (signature !== expectedSignature) return null;
    
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (decodedPayload.exp < Date.now()) return null;
    
    return decodedPayload.userId;
  } catch {
    return null;
  }
}

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/'
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.delete(COOKIE_NAME);
}

export function getAuthToken(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value || null;
}
