import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const part = searchParams.get('part');
    const category = searchParams.get('category');
    const count = parseInt(searchParams.get('count') || '5');

    const whereClause: any = { isActive: true };
    if (part) whereClause.partNumber = parseInt(part);
    if (category) whereClause.category = category;

    const questions = await db.questionBank.findMany({
      where: whereClause,
      orderBy: [
        { createdAt: 'desc' }
      ],
      take: count
    });

    if (questions.length === 0) {
      return NextResponse.json({
        success: true,
        questions: []
      });
    }

    return NextResponse.json({
      success: true,
      questions: questions.map(q => ({
        id: q.id,
        questionText: q.questionText,
        category: q.category,
        difficulty: q.difficulty
      }))
    });
  } catch (error) {
    console.error('Get questions error:', error);
    return NextResponse.json({
      success: false,
      error: '获取题目失败'
    }, { status: 500 });
  }
}
