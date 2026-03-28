import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET - 导出题库
export async function GET() {
  try {
    const questions = await db.questionBank.findMany({
      where: { isActive: true },
      orderBy: [{ partNumber: 'asc' }, { category: 'asc' }]
    });

    return NextResponse.json({
      success: true,
      total: questions.length,
      exportedAt: new Date().toISOString(),
      questions: questions.map(q => ({
        partNumber: q.partNumber,
        category: q.category,
        questionText: q.questionText,
        followUpQuestions: q.followUpQuestions,
        difficulty: q.difficulty
      }))
    });
  } catch (error) {
    console.error('Export questions error:', error);
    return NextResponse.json({
      success: false,
      error: '导出失败'
    }, { status: 500 });
  }
}

// POST - 导入题库
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questions, mode = 'append', poolId } = body;

    if (!questions || !Array.isArray(questions)) {
      return NextResponse.json({
        success: false,
        error: '无效的题库格式'
      }, { status: 400 });
    }

    // 如果是替换模式且指定了题库，只清空该题库的题目
    if (mode === 'replace' && poolId) {
      await db.questionBank.deleteMany({
        where: { poolId }
      });
    } else if (mode === 'replace') {
      // 没有指定题库，清空所有
      await db.questionBank.deleteMany({});
    }

    // 导入题目
    let imported = 0;
    for (const q of questions) {
      if (!q.partNumber || !q.questionText) continue;

      await db.questionBank.create({
        data: {
          partNumber: parseInt(q.partNumber),
          category: q.category || 'General',
          questionText: q.questionText,
          followUpQuestions: q.followUpQuestions || null,
          difficulty: q.difficulty || 'medium',
          isActive: true,
          poolId: poolId || null  // 关联到指定题库
        }
      });
      imported++;
    }

    return NextResponse.json({
      success: true,
      message: `成功导入 ${imported} 道题目`,
      imported
    });
  } catch (error) {
    console.error('Import questions error:', error);
    return NextResponse.json({
      success: false,
      error: '导入失败'
    }, { status: 500 });
  }
}

// DELETE - 清空题库
export async function DELETE() {
  try {
    const result = await db.questionBank.deleteMany({});

    return NextResponse.json({
      success: true,
      message: `已清空 ${result.count} 道题目`
    });
  } catch (error) {
    console.error('Clear questions error:', error);
    return NextResponse.json({
      success: false,
      error: '清空失败'
    }, { status: 500 });
  }
}
