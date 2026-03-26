import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// POST - 使用邀请码续费
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: '请先登录'
      }, { status: 401 });
    }

    const body = await request.json();
    const { inviteCode } = body;

    if (!inviteCode) {
      return NextResponse.json({
        success: false,
        error: '请输入邀请码'
      }, { status: 400 });
    }

    // 获取完整用户信息
    const fullUser = await db.user.findUnique({
      where: { id: user.id }
    });

    if (!fullUser) {
      return NextResponse.json({
        success: false,
        error: '用户不存在'
      }, { status: 404 });
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

    if (code.usedCount >= code.maxUses) {
      return NextResponse.json({
        success: false,
        error: '邀请码使用次数已达上限'
      }, { status: 400 });
    }

    if (!code.validDays) {
      return NextResponse.json({
        success: false,
        error: '该邀请码为永久有效类型，无法用于续费'
      }, { status: 400 });
    }

    // 计算新的过期时间
    const now = new Date();
    let newExpiresAt: Date;

    if (fullUser.expiresAt && new Date(fullUser.expiresAt) > now) {
      // 未过期：在当前过期时间基础上叠加
      newExpiresAt = new Date(fullUser.expiresAt.getTime() + code.validDays * 24 * 60 * 60 * 1000);
    } else {
      // 已过期或首次激活：从现在开始计算
      newExpiresAt = new Date(now.getTime() + code.validDays * 24 * 60 * 60 * 1000);
    }

    // 更新用户有效期
    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: {
        expiresAt: newExpiresAt,
        status: 'approved', // 确保状态为已批准
        activatedAt: fullUser.activatedAt || now // 如果之前没有激活时间，设置现在
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

    return NextResponse.json({
      success: true,
      message: `续费成功，有效期延长 ${code.validDays} 天`,
      expiresAt: updatedUser.expiresAt?.toISOString()
    });

  } catch (error) {
    console.error('Renew error:', error);
    return NextResponse.json({
      success: false,
      error: '续费失败，请稍后重试'
    }, { status: 500 });
  }
}
