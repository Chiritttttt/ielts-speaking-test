import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// 获取评估状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: '缺少 sessionId'
      }, { status: 400 });
    }

    const session = await db.testSession.findUnique({
      where: { id: sessionId },
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
            improvements: true,
            strengths: true,
            modelAnswer: true
          }
        }
      }
    });

    if (!session) {
      return NextResponse.json({
        success: false,
        error: '会话不存在'
      }, { status: 404 });
    }

    // 计算评估进度
    const totalResponses = session.responses.length;
    const evaluatedResponses = session.responses.filter(r => r.overallScore !== null).length;
    const progress = totalResponses > 0 ? Math.round((evaluatedResponses / totalResponses) * 100) : 0;

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        testType: session.testType,
        status: session.status,
        evaluationStatus: session.evaluationStatus || 'pending',
        evaluationProgress: progress,
        evaluationMessage: session.evaluationMessage,
        bandScore: session.bandScore,
        startedAt: session.startedAt.toISOString(),
        completedAt: session.completedAt?.toISOString(),
        evaluatedAt: session.evaluatedAt?.toISOString(),
        responses: session.responses,
        totalResponses,
        evaluatedResponses
      }
    });
  } catch (error) {
    console.error('[EvaluateStatus] Error:', error);
    return NextResponse.json({
      success: false,
      error: '获取状态失败: ' + (error instanceof Error ? error.message : '未知错误')
    }, { status: 500 });
  }
}
