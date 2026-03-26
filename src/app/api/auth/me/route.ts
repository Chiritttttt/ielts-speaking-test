import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, getAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    
    if (!token) {
      return NextResponse.json({
        success: false,
        error: '未登录'
      }, { status: 401 });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return NextResponse.json({
        success: false,
        error: '登录已过期'
      }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        level: true,
        role: true,
        status: true,
        createdAt: true,
        activatedAt: true,
        expiresAt: true
      }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: '用户不存在'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        ...user,
        createdAt: user.createdAt.toISOString(),
        activatedAt: user.activatedAt?.toISOString(),
        expiresAt: user.expiresAt?.toISOString()
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({
      success: false,
      error: '获取用户信息失败'
    }, { status: 500 });
  }
}
