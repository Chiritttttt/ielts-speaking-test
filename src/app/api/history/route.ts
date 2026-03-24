import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const userId = searchParams.get('userId');

    const whereClause: any = {};
    if (userId && !userId.startsWith('guest')) {
      whereClause.userId = userId;
    }

    const sessions = await db.testSession.findMany({
      where: whereClause,
      include: {
        responses: {
          select: {
            id: true,
            partNumber: true,
            overallScore: true,
            questionText: true,
            transcription: true
          }
        }
      },
      orderBy: { startedAt: 'desc' },
      take: limit,
      skip: offset
    });

    return NextResponse.json({
      success: true,
      sessions: sessions.map(s => ({
        id: s.id,
        testType: s.testType,
        status: s.status,
        evaluationStatus: s.evaluationStatus || 'pending',
        evaluationProgress: s.evaluationProgress || 0,
        evaluationMessage: s.evaluationMessage,
        bandScore: s.bandScore,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString(),
        evaluatedAt: s.evaluatedAt?.toISOString(),
        responses: s.responses,
        createdAt: s.createdAt?.toISOString()
      }))
    });
  } catch (error) {
    console.error('Get history error:', error);
    return NextResponse.json({
      success: false,
      error: '获取历史记录失败'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { ids, sessionId, clearAll, userId } = body;

    // 批量删除
    if (ids && Array.isArray(ids) && ids.length > 0) {
      // 先删除关联的回答
      await db.speakingResponse.deleteMany({
        where: { sessionId: { in: ids } }
      });
      // 再删除会话
      await db.testSession.deleteMany({
        where: { id: { in: ids } }
      });
      return NextResponse.json({ success: true, message: `${ids.length} 条记录已删除` });
    }

    // 清空所有
    if (clearAll) {
      if (userId && !userId.startsWith('guest')) {
        await db.speakingResponse.deleteMany({
          where: { session: { userId } }
        });
        await db.testSession.deleteMany({
          where: { userId }
        });
      }
      return NextResponse.json({ success: true, message: 'All sessions deleted' });
    }

    // 删除单个
    if (sessionId) {
      await db.speakingResponse.deleteMany({
        where: { sessionId }
      });
      await db.testSession.delete({
        where: { id: sessionId }
      });
      return NextResponse.json({ success: true, message: 'Session deleted' });
    }

    return NextResponse.json({
      success: false,
      error: 'No session ID provided'
    }, { status: 400 });
  } catch (error) {
    console.error('Delete history error:', error);
    return NextResponse.json({
      success: false,
      error: '删除失败'
    }, { status: 500 });
  }
}
