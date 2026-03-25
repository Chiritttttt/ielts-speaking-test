import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * 获取当前有效的公告列表（公开）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const all = searchParams.get('all');

    // 如果是 admin 请求，返回所有公告
    if (all === 'true') {
      const announcements = await db.announcement.findMany({
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      return NextResponse.json({
        success: true,
        announcements
      });
    }

    // 否则返回当前有效的公告
    const now = new Date();

    const announcements = await db.announcement.findMany({
      where: {
        isActive: true,
        OR: [
          { startDate: null },
          { startDate: { lte: now } }
        ],
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 5
    });

    // 过滤掉已过期的公告
    const validAnnouncements = announcements.filter(a => 
      !a.endDate || new Date(a.endDate) >= now
    );

    return NextResponse.json({
      success: true,
      announcements: validAnnouncements
    });
  } catch (error) {
    console.error('[Announcement] Get error:', error);
    return NextResponse.json({
      success: false,
      error: '获取公告失败'
    }, { status: 500 });
  }
}

/**
 * 创建新公告（需要管理员权限）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, content, type, isActive, priority, startDate, endDate } = body;

    if (!title || !content) {
      return NextResponse.json({
        success: false,
        error: '标题和内容不能为空'
      }, { status: 400 });
    }

    const announcement = await db.announcement.create({
      data: {
        title,
        content,
        type: type || 'info',
        isActive: isActive ?? true,
        priority: priority || 0,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      }
    });

    return NextResponse.json({
      success: true,
      announcement
    });
  } catch (error) {
    console.error('[Announcement] Create error:', error);
    return NextResponse.json({
      success: false,
      error: '创建公告失败'
    }, { status: 500 });
  }
}

/**
 * 更新公告（需要管理员权限）
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, title, content, type, isActive, priority, startDate, endDate } = body;

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '公告 ID 不能为空'
      }, { status: 400 });
    }

    const announcement = await db.announcement.update({
      where: { id },
      data: {
        title,
        content,
        type,
        isActive,
        priority,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null
      }
    });

    return NextResponse.json({
      success: true,
      announcement
    });
  } catch (error) {
    console.error('[Announcement] Update error:', error);
    return NextResponse.json({
      success: false,
      error: '更新公告失败'
    }, { status: 500 });
  }
}

/**
 * 删除公告（需要管理员权限）
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: '公告 ID 不能为空'
      }, { status: 400 });
    }

    await db.announcement.delete({
      where: { id }
    });

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    console.error('[Announcement] Delete error:', error);
    return NextResponse.json({
      success: false,
      error: '删除公告失败'
    }, { status: 500 });
  }
}
