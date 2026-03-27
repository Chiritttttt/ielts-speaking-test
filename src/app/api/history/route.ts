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

/**
 * PATCH - 清理未完成的会话
 * 用于用户中途退出时清理没有录音内容的会话
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, userId } = body;

    console.log('[History PATCH] Cleaning up incomplete sessions:', { sessionId, userId });

    // 清理指定的单个会话（如果没有录音内容）
    if (sessionId) {
      const session = await db.testSession.findUnique({
        where: { id: sessionId },
        include: { 
          responses: {
            select: { id: true, transcription: true }
          }
        }
      });

      if (session) {
        // 检查是否有有效的录音内容（有转录文本）
        const hasContent = session.responses.some(r => r.transcription && r.transcription.trim().length > 0);

        if (!hasContent) {
          // 没有内容，删除整个会话
          await db.speakingResponse.deleteMany({
            where: { sessionId }
          });
          await db.testSession.delete({
            where: { id: sessionId }
          });
          console.log('[History PATCH] Deleted empty session:', sessionId);
          return NextResponse.json({ success: true, message: '已删除空会话' });
        } else {
          // 有内容，保留会话但标记为待评估
          await db.testSession.update({
            where: { id: sessionId },
            data: {
              status: 'completed',
              completedAt: new Date()
            }
          });
          console.log('[History PATCH] Preserved session with content:', sessionId);
          return NextResponse.json({ success: true, message: '会话已保留，可在历史记录中继续评估' });
        }
      }

      return NextResponse.json({ success: true, message: '会话不存在' });
    }

    // 清理用户所有未完成的空会话
    if (userId && !userId.startsWith('guest')) {
      // 找到所有 in_progress 状态的会话
      const incompleteSessions = await db.testSession.findMany({
        where: { 
          userId,
          status: 'in_progress'
        },
        include: {
          responses: {
            select: { id: true, transcription: true }
          }
        }
      });

      let deletedCount = 0;
      let preservedCount = 0;

      for (const session of incompleteSessions) {
        const hasContent = session.responses.some(r => r.transcription && r.transcription.trim().length > 0);

        if (!hasContent) {
          // 删除空会话
          await db.speakingResponse.deleteMany({
            where: { sessionId: session.id }
          });
          await db.testSession.delete({
            where: { id: session.id }
          });
          deletedCount++;
        } else {
          // 保留有内容的会话
          await db.testSession.update({
            where: { id: session.id },
            data: {
              status: 'completed',
              completedAt: new Date()
            }
          });
          preservedCount++;
        }
      }

      console.log('[History PATCH] Cleaned up sessions:', { deletedCount, preservedCount });
      return NextResponse.json({ 
        success: true, 
        message: `已清理 ${deletedCount} 个空会话，保留 ${preservedCount} 个有内容的会话`
      });
    }

    return NextResponse.json({ success: true, message: '无操作' });
  } catch (error) {
    console.error('[History PATCH] Error:', error);
    return NextResponse.json({
      success: false,
      error: '清理失败'
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
