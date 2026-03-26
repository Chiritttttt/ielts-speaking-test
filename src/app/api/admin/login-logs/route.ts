import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

/**
 * 管理员查看登录日志
 * GET /api/admin/login-logs?userId=xxx&limit=50&offset=0
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const success = searchParams.get('success'); // 'true', 'false', or null (all)

    const whereClause: any = {};
    if (userId) whereClause.userId = userId;
    if (username) whereClause.username = { contains: username };
    if (success !== null && success !== 'all') {
      whereClause.success = success === 'true';
    }

    const logs = await db.loginLog.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    });

    // 获取总数
    const total = await db.loginLog.count({ where: whereClause });

    // 统计信息
    const stats = await db.loginLog.aggregate({
      where: userId ? { userId } : {},
      _count: true,
      _sum: {
        success: true
      }
    });

    // 今日登录统计
    const today = new Date().toISOString().split('T')[0];
    const todayLogs = await db.loginLog.count({
      where: {
        createdAt: {
          gte: new Date(today)
        },
        success: true
      }
    });

    // 今日失败统计
    const todayFailed = await db.loginLog.count({
      where: {
        createdAt: {
          gte: new Date(today)
        },
        success: false
      }
    });

    return NextResponse.json({
      success: true,
      logs: logs.map(log => ({
        id: log.id,
        userId: log.userId,
        username: log.username,
        success: log.success,
        failReason: log.failReason,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt.toISOString()
      })),
      stats: {
        total,
        successCount: stats._sum.success || 0,
        failedCount: stats._count - (stats._sum.success || 0),
        todayLogins: todayLogs,
        todayFailed
      },
      pagination: {
        limit,
        offset,
        total
      }
    });
  } catch (error) {
    console.error('Get login logs error:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
