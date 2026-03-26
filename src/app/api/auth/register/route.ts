import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, name, inviteCode } = body;

    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: '用户名和密码不能为空'
      }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({
        success: false,
        error: '用户名至少需要3个字符'
      }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({
        success: false,
        error: '密码至少需要6个字符'
      }, { status: 400 });
    }

    // 检查是否有管理员账号
    const adminCount = await db.user.count({
      where: { role: 'admin' }
    });

    // 如果没有管理员，允许使用初始化密码创建管理员
    if (adminCount === 0) {
      const setupCode = process.env.ADMIN_SETUP_CODE || 'IELTS2024';
      if (inviteCode === setupCode) {
        // 创建管理员账号
        const hashedPassword = await hashPassword(password);
        const user = await db.user.create({
          data: {
            username,
            password: hashedPassword,
            name: name || 'Administrator',
            role: 'admin',
            status: 'approved'
          }
        });

        await db.userSettings.create({
          data: {
            userId: user.id,
            defaultVoice: 'us-female',
            voiceSpeed: 1.0,
            showQuestionAfterSpeech: false,
            autoPlayQuestion: true
          }
        });

        const token = generateToken(user.id);
        const response = NextResponse.json({
          success: true,
          isAdmin: true,
          message: '管理员账号创建成功',
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            status: user.status,
            createdAt: user.createdAt.toISOString()
          }
        });
        
        setAuthCookie(response, token);
        return response;
      }
    }

    // 正常注册流程：需要邀请码
    if (!inviteCode) {
      return NextResponse.json({
        success: false,
        error: '需要邀请码才能注册',
        needsInviteCode: true
      }, { status: 400 });
    }

    // 验证邀请码
    const code = await db.inviteCode.findUnique({
      where: { code: inviteCode }
    });

    if (!code) {
      return NextResponse.json({
        success: false,
        error: '邀请码无效'
      }, { status: 400 });
    }

    if (code.status === 'disabled') {
      return NextResponse.json({
        success: false,
        error: '邀请码已失效'
      }, { status: 400 });
    }

    // 检查使用次数
    if (code.usedCount >= code.maxUses) {
      return NextResponse.json({
        success: false,
        error: '邀请码使用次数已达上限'
      }, { status: 400 });
    }

    // 检查用户名是否已存在
    const existingUser = await db.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: '用户名已被使用'
      }, { status: 400 });
    }

    // 计算用户过期时间
    const activatedAt = new Date();
    let expiresAt: Date | null = null;
    if (code.validDays) {
      expiresAt = new Date(activatedAt.getTime() + code.validDays * 24 * 60 * 60 * 1000);
    }

    // 创建用户（邀请码注册直接通过，无需审批）
    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: {
        username,
        password: hashedPassword,
        name: name || username,
        level: 'intermediate',
        role: 'user',
        status: 'approved', // 邀请码注册直接通过
        invitedBy: code.createdById,
        activatedAt,
        expiresAt
      }
    });

    // 更新邀请码使用次数
    const newUsedCount = code.usedCount + 1;
    await db.inviteCode.update({
      where: { id: code.id },
      data: {
        usedCount: { increment: 1 },
        status: newUsedCount >= code.maxUses ? 'used' : 'active'
      }
    });

    await db.userSettings.create({
      data: {
        userId: user.id,
        defaultVoice: 'us-female',
        voiceSpeed: 1.0,
        showQuestionAfterSpeech: false,
        autoPlayQuestion: true
      }
    });

    const token = generateToken(user.id);
    const response = NextResponse.json({
      success: true,
      message: '注册成功，欢迎使用雅思口语练习平台',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        status: user.status,
        level: user.level,
        activatedAt: user.activatedAt?.toISOString(),
        expiresAt: user.expiresAt?.toISOString(),
        createdAt: user.createdAt.toISOString()
      }
    });
    
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({
      success: false,
      error: '注册失败，请稍后重试'
    }, { status: 500 });
  }
}
