import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// 计算邀请码是否过期
function isCodeExpired(code: { validDays: number | null; firstUsedAt: Date | null; expiresAt: Date | null }): boolean {
  // 新逻辑：从首次使用开始计算
  if (code.validDays && code.firstUsedAt) {
    const expiresAt = new Date(code.firstUsedAt.getTime() + code.validDays * 24 * 60 * 60 * 1000);
    return new Date() > expiresAt;
  }
  // 兼容旧逻辑：创建时设置的过期时间
  if (code.expiresAt) {
    return new Date() > code.expiresAt;
  }
  // 永不过期
  return false;
}

// 验证邀请码（注册前检查）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inviteCode } = body;

    if (!inviteCode) {
      return NextResponse.json({
        success: false,
        error: '请输入邀请码'
      }, { status: 400 });
    }

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

    // 使用新的过期检查逻辑
    if (isCodeExpired(code)) {
      return NextResponse.json({
        success: false,
        error: '邀请码已过期'
      }, { status: 400 });
    }

    if (code.usedCount >= code.maxUses) {
      return NextResponse.json({
        success: false,
        error: '邀请码使用次数已达上限'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: '邀请码有效',
      remainingUses: code.maxUses - code.usedCount
    });
  } catch (error) {
    console.error('Verify invite code error:', error);
    return NextResponse.json({
      success: false,
      error: '验证失败'
    }, { status: 500 });
  }
}
