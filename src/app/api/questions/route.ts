import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// 难度排序映射
const DIFFICULTY_ORDER: Record<string, number> = {
  'easy': 1,
  'medium': 2,
  'hard': 3
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const part = searchParams.get('part');
    const category = searchParams.get('category');
    const count = parseInt(searchParams.get('count') || '5');

    const whereClause: any = { isActive: true };
    if (part) whereClause.partNumber = parseInt(part);
    if (category) whereClause.category = category;

    // 获取题目
    const questions = await db.questionBank.findMany({
      where: whereClause,
      take: count * 3 // 获取更多以便排序
    });

    if (questions.length === 0) {
      return NextResponse.json({
        success: true,
        questions: []
      });
    }

    // 按难度排序：easy -> medium -> hard
    const sortedQuestions = questions.sort((a, b) => {
      const orderA = DIFFICULTY_ORDER[a.difficulty] || 2;
      const orderB = DIFFICULTY_ORDER[b.difficulty] || 2;
      return orderA - orderB;
    }).slice(0, count);

    return NextResponse.json({
      success: true,
      questions: sortedQuestions.map(q => ({
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
