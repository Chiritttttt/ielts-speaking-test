import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await db.testSession.findUnique({
      where: { id },
      include: {
        responses: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Session not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        testType: session.testType,
        status: session.status,
        bandScore: session.bandScore,
        startedAt: session.startedAt.toISOString(),
        completedAt: session.completedAt?.toISOString(),
        responses: session.responses.map(r => ({
          id: r.id,
          partNumber: r.partNumber,
          questionText: r.questionText,
          transcription: r.transcription,
          audioBase64: r.audioBase64,
          duration: r.duration,
          fluencyScore: r.fluencyScore,
          vocabularyScore: r.vocabularyScore,
          grammarScore: r.grammarScore,
          pronunciationScore: r.pronunciationScore,
          overallScore: r.overallScore,
          feedback: r.feedback ? JSON.parse(r.feedback) : null,
          improvements: r.improvements ? JSON.parse(r.improvements) : [],
          strengths: r.strengths ? JSON.parse(r.strengths) : [],
          modelAnswer: r.modelAnswer
        }))
      }
    });
  } catch (error) {
    console.error('Get session detail error:', error);
    return NextResponse.json({
      success: false,
      error: '获取详情失败'
    }, { status: 500 });
  }
}
