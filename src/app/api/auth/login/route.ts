import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: '请输入用户名和密码'
      }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { username }
    });

    if (!user) {
      return NextResponse.json({
        success: false,
        error: '用户名或密码错误'
      }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json({
        success: false,
        error: '用户名或密码错误'
      }, { status: 401 });
    }

    const token = generateToken(user.id);
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        level: user.level,
        createdAt: user.createdAt.toISOString()
      }
    });
    
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      success: false,
      error: '登录失败，请稍后重试'
    }, { status: 500 });
  }
}
