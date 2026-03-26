import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

/**
 * 管理员查看指定用户的练习记录
 * GET /api/admin/user-sessions?userId=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!userId) {
      return NextResponse.json({ success: false, error: '缺少用户ID' }, { status: 400 });
    }

    // 获取用户信息
    const userInfo = await db.user.findUnique({
      where: { id: userId },
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
        registeredIp: true,
        _count: {
          select: { testSessions: true }
        }
      }
    });

    if (!userInfo) {
      return NextResponse.json({ success: false, error: '用户不存在' }, { status: 404 });
    }

    // 获取练习记录
    const sessions = await db.testSession.findMany({
      where: { userId },
      include: {
        responses: {
          select: {
            id: true,
            partNumber: true,
            questionText: true,
            transcription: true,
            overallScore: true,
            fluencyScore: true,
            vocabularyScore: true,
            grammarScore: true,
            pronunciationScore: true,
            feedback: true,
            duration: true,
            createdAt: true
          },
          orderBy: { partNumber: 'asc' }
        }
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset
    });

    // 统计数据 - 安全处理
    let stats = { _count: 0, _avg: { bandScore: null as number | null }, _max: { bandScore: null as number | null }, _min: { bandScore: null as number | null } };
    
    try {
      stats = await db.testSession.aggregate({
        where: { userId },
        _count: true,
        _avg: { bandScore: true },
        _max: { bandScore: true },
        _min: { bandScore: true }
      });
    } catch (e) {
      console.error('Stats aggregate error:', e);
    }

    // 按日期统计 - 使用 Prisma 查询而非原始 SQL
    let dailyStats: { date: string; count: number; avgScore: number | null }[] = [];
    try {
      // 获取最近30天的会话
      const recentSessions = await db.testSession.findMany({
        where: {
          userId,
          startedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        select: {
          startedAt: true,
          bandScore: true
        },
        orderBy: { startedAt: 'desc' }
      });

      // 手动按日期分组
      const dateMap = new Map<string, { count: number; totalScore: number; scoreCount: number }>();
      
      for (const session of recentSessions) {
        const dateStr = session.startedAt.toISOString().split('T')[0];
        const existing = dateMap.get(dateStr) || { count: 0, totalScore: 0, scoreCount: 0 };
        existing.count++;
        if (session.bandScore !== null) {
          existing.totalScore += session.bandScore;
          existing.scoreCount++;
        }
        dateMap.set(dateStr, existing);
      }

      dailyStats = Array.from(dateMap.entries())
        .map(([date, data]) => ({
          date,
          count: data.count,
          avgScore: data.scoreCount > 0 ? data.totalScore / data.scoreCount : null
        }))
        .sort((a, b) => b.date.localeCompare(a.date));
    } catch (e) {
      console.error('Daily stats error:', e);
    }

    return NextResponse.json({
      success: true,
      user: {
        ...userInfo,
        createdAt: userInfo.createdAt.toISOString(),
        activatedAt: userInfo.activatedAt?.toISOString(),
        expiresAt: userInfo.expiresAt?.toISOString(),
        testCount: userInfo._count.testSessions
      },
      sessions: sessions.map(s => ({
        id: s.id,
        testType: s.testType,
        status: s.status,
        evaluationStatus: s.evaluationStatus || 'pending',
        evaluationProgress: s.evaluationProgress || 0,
        bandScore: s.bandScore,
        totalScore: s.totalScore,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString(),
        evaluatedAt: s.evaluatedAt?.toISOString(),
        duration: s.responses.reduce((sum, r) => sum + (r.duration || 0), 0),
        responses: s.responses.map(r => ({
          id: r.id,
          partNumber: r.partNumber,
          questionText: r.questionText,
          transcription: r.transcription,
          overallScore: r.overallScore,
          fluencyScore: r.fluencyScore,
          vocabularyScore: r.vocabularyScore,
          grammarScore: r.grammarScore,
          pronunciationScore: r.pronunciationScore,
          feedback: r.feedback,
          duration: r.duration,
          createdAt: r.createdAt?.toISOString()
        }))
      })),
      stats: {
        totalSessions: stats._count,
        avgBandScore: stats._avg.bandScore,
        maxBandScore: stats._max.bandScore,
        minBandScore: stats._min.bandScore,
        dailyStats
      },
      pagination: {
        limit,
        offset,
        total: userInfo._count.testSessions
      }
    });
  } catch (error) {
    console.error('Get user sessions error:', error);
    return NextResponse.json({ success: false, error: '获取失败' }, { status: 500 });
  }
}
