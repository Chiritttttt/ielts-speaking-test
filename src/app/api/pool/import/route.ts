import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * 批量导入题目到题库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poolId, questions } = body;

    if (!poolId) {
      return NextResponse.json({
        success: false,
        error: '请指定目标题库'
      }, { status: 400 });
    }

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return NextResponse.json({
        success: false,
        error: '请提供题目数据'
      }, { status: 400 });
    }

    // 验证题库存在
    const pool = await db.questionPool.findUnique({
      where: { id: poolId }
    });

    if (!pool) {
      return NextResponse.json({
        success: false,
        error: '题库不存在'
      }, { status: 404 });
    }

    // 格式化题目数据
    const formattedQuestions = questions.map((q: any) => ({
      partNumber: q.partNumber || 1,
      category: q.category || 'General',
      questionText: q.questionText || q.question || q.text,
      followUpQuestions: q.followUpQuestions ? JSON.stringify(q.followUpQuestions) : null,
      difficulty: q.difficulty || 'medium',
      isActive: true,
      poolId
    }));

    // 批量创建
    const result = await db.questionBank.createMany({
      data: formattedQuestions
    });

    // 更新题库统计
    const counts = await db.questionBank.groupBy({
      by: ['partNumber'],
      where: { poolId, isActive: true },
      _count: true
    });

    await db.questionPool.update({
      where: { id: poolId },
      data: {
        part1Count: counts.find(c => c.partNumber === 1)?._count || 0,
        part2Count: counts.find(c => c.partNumber === 2)?._count || 0,
        part3Count: counts.find(c => c.partNumber === 3)?._count || 0,
        source: 'import'
      }
    });

    return NextResponse.json({
      success: true,
      imported: result.count,
      poolId
    });
  } catch (error) {
    console.error('[Pool Import] Error:', error);
    return NextResponse.json({
      success: false,
      error: '导入题目失败'
    }, { status: 500 });
  }
}
