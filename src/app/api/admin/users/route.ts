import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// GET - 获取用户列表（管理员）
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const role = searchParams.get('role');

    const whereClause: any = {};
    if (status) whereClause.status = status;
    if (role) whereClause.role = role;

    const users = await db.user.findMany({
      where: whereClause,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        activatedAt: true,
        expiresAt: true,
        invitedBy: true,
        _count: {
          select: { testSessions: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({
      success: true,
      users: users.map(u => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        activatedAt: u.activatedAt?.toISOString(),
        expiresAt: u.expiresAt?.toISOString(),
        testCount: u._count.testSessions
      }))
    });
  } catch (error) {
    console.error('Get users error:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}

// PATCH - 更新用户状态（审批/拒绝/禁用）
export async function PATCH(request: NextRequest) {
  try {
    const admin = await getCurrentUser(request);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, status, role } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: '缺少用户ID' }, { status: 400 });
    }

    // 不能修改自己的状态
    if (userId === admin.id) {
      return NextResponse.json({ success: false, error: '不能修改自己的状态' }, { status: 400 });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (role) updateData.role = role;

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      message: '更新成功',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        status: updatedUser.status,
        role: updatedUser.role
      }
    });
  } catch (error) {
    console.error('Update user error:', error);
    return NextResponse.json({ success: false, error: '更新失败' }, { status: 500 });
  }
}

// DELETE - 删除用户
export async function DELETE(request: NextRequest) {
  try {
    const admin = await getCurrentUser(request);
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: '缺少用户ID' }, { status: 400 });
    }

    if (userId === admin.id) {
      return NextResponse.json({ success: false, error: '不能删除自己' }, { status: 400 });
    }

    await db.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true, message: '用户已删除' });
  } catch (error) {
    console.error('Delete user error:', error);
    return NextResponse.json({ success: false, error: '删除失败' }, { status: 500 });
  }
}
