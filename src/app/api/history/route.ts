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
            overallScore: true
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
        bandScore: s.bandScore,
        startedAt: s.startedAt.toISOString(),
        completedAt: s.completedAt?.toISOString(),
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
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const clearAll = searchParams.get('clearAll');

    if (clearAll === 'true') {
      const userId = searchParams.get('userId');
      if (userId && !userId.startsWith('guest')) {
        await db.testSession.deleteMany({
          where: { userId }
        });
      }
      return NextResponse.json({ success: true, message: 'All sessions deleted' });
    }

    if (sessionId) {
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
