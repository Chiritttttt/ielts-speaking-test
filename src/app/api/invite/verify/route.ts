import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    // 只检查使用次数，邀请码本身不再有过期时间
    if (code.usedCount >= code.maxUses) {
      return NextResponse.json({
        success: false,
        error: '邀请码使用次数已达上限'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: '邀请码有效',
      remainingUses: code.maxUses - code.usedCount,
      validDays: code.validDays // 返回有效天数供前端显示
    });
  } catch (error) {
    console.error('Verify invite code error:', error);
    return NextResponse.json({
      success: false,
      error: '验证失败'
    }, { status: 500 });
  }
}
