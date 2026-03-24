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

export function getAuthToken(request?: NextRequest): string | null {
  if (request) {
    return request.cookies.get(COOKIE_NAME)?.value || null;
  }
  // 服务端调用时从 cookies 中获取
  if (typeof globalThis !== 'undefined') {
    return null;
  }
  return null;
}

// 获取当前用户（包含角色和状态信息）
export async function getCurrentUser(request?: NextRequest): Promise<{
  id: string;
  username: string;
  name?: string | null;
  role: string;
  status: string;
} | null> {
  const token = getAuthToken(request);
  if (!token) return null;
  
  const userId = verifyToken(token);
  if (!userId) return null;
  
  try {
    const { db } = await import('./db');
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, name: true, role: true, status: true }
    });
    return user;
  } catch {
    return null;
  }
}

// 检查用户是否已获批准
export async function isUserApproved(request?: NextRequest): Promise<boolean> {
  const user = await getCurrentUser(request);
  if (!user) return false;
  
  // 管理员始终有权限
  if (user.role === 'admin') return true;
  
  // 普通用户需要状态为 approved
  return user.status === 'approved';
}
