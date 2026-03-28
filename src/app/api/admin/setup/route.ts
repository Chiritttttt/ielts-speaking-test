import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

// 检查是否需要初始化
export async function GET() {
  try {
    const adminCount = await db.user.count({
      where: { role: 'admin' }
    });

    const userCount = await db.user.count();

    return NextResponse.json({
      success: true,
      needsSetup: adminCount === 0,
      hasUsers: userCount > 0,
      adminCount,
      userCount
    });
  } catch (error) {
    console.error('Check setup error:', error);
    return NextResponse.json({ success: false, error: '检查失败' }, { status: 500 });
  }
}

// 初始化管理员账号
export async function POST(request: NextRequest) {
  try {
    // 检查是否已有管理员
    const adminCount = await db.user.count({
      where: { role: 'admin' }
    });

    if (adminCount > 0) {
      return NextResponse.json({
        success: false,
        error: '系统已初始化，无法重复创建管理员'
      }, { status: 400 });
    }

    const body = await request.json();
    const { username, password, name, setupCode } = body;

    // 验证初始化密码（可选，增加安全性）
    const expectedSetupCode = process.env.ADMIN_SETUP_CODE || 'IELTS2024';
    if (setupCode !== expectedSetupCode) {
      return NextResponse.json({
        success: false,
        error: '初始化密码错误'
      }, { status: 400 });
    }

    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: '用户名和密码不能为空'
      }, { status: 400 });
    }

    // 检查用户名是否已存在
    const existing = await db.user.findUnique({
      where: { username }
    });

    if (existing) {
      return NextResponse.json({
        success: false,
        error: '用户名已存在'
      }, { status: 400 });
    }

    // 创建管理员账号
    const hashedPassword = await hashPassword(password);
    const admin = await db.user.create({
      data: {
        username,
        password: hashedPassword,
        name: name || 'Administrator',
        role: 'admin',
        status: 'approved'
      }
    });

    return NextResponse.json({
      success: true,
      message: '管理员账号创建成功',
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name
      }
    });
  } catch (error) {
    console.error('Setup admin error:', error);
    return NextResponse.json({ success: false, error: '初始化失败' }, { status: 500 });
  }
}
