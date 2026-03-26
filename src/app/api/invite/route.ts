import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// 生成随机邀请码
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// GET - 获取所有邀请码（管理员）
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const codes = await db.inviteCode.findMany({
      include: {
        createdBy: { select: { id: true, username: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      codes: codes.map(c => ({
        id: c.id,
        code: c.code,
        status: c.status,
        maxUses: c.maxUses,
        usedCount: c.usedCount,
        validDays: c.validDays,
        createdAt: c.createdAt.toISOString(),
        createdBy: c.createdBy
      }))
    });
  } catch (error) {
    console.error('Get invite codes error:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}

// POST - 创建邀请码（管理员）
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { maxUses = 1, validDays, count = 1 } = body;

    const codes = [];
    for (let i = 0; i < count; i++) {
      let codeStr = generateInviteCode();
      // 确保唯一
      while (await db.inviteCode.findUnique({ where: { code: codeStr } })) {
        codeStr = generateInviteCode();
      }

      const code = await db.inviteCode.create({
        data: {
          code: codeStr,
          maxUses,
          validDays: validDays || null, // 每个用户的有效天数，null 表示永不过期
          createdById: user.id
        }
      });
      codes.push(code);
    }

    return NextResponse.json({
      success: true,
      message: `成功创建 ${codes.length} 个邀请码`,
      codes: codes.map(c => ({
        id: c.id,
        code: c.code,
        maxUses: c.maxUses,
        validDays: c.validDays
      }))
    });
  } catch (error) {
    console.error('Create invite code error:', error);
    return NextResponse.json({ success: false, error: '创建失败' }, { status: 500 });
  }
}

// DELETE - 删除/禁用邀请码
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { id, code } = body;

    if (id) {
      await db.inviteCode.delete({ where: { id } });
    } else if (code) {
      await db.inviteCode.delete({ where: { code } });
    } else {
      return NextResponse.json({ success: false, error: '缺少参数' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('Delete invite code error:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
