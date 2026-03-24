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

    // 检查用户状态
    if (user.status === 'pending') {
      return NextResponse.json({
        success: false,
        error: '账号正在等待管理员审批，请耐心等待',
        status: 'pending'
      }, { status: 403 });
    }

    if (user.status === 'rejected') {
      return NextResponse.json({
        success: false,
        error: '您的注册申请已被拒绝',
        status: 'rejected'
      }, { status: 403 });
    }

    if (user.status === 'suspended') {
      return NextResponse.json({
        success: false,
        error: '账号已被停用，请联系管理员',
        status: 'suspended'
      }, { status: 403 });
    }

    const token = generateToken(user.id);
    const response = NextResponse.json({
      success: true,
      isAdmin: user.role === 'admin',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        level: user.level,
        role: user.role,
        status: user.status,
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
