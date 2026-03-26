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
    const poolId = searchParams.get('poolId');
    const getCategories = searchParams.get('getCategories') === 'true'; // 获取话题列表

    // 如果请求话题列表
    if (getCategories) {
      const whereClause: any = { isActive: true };
      if (part) whereClause.partNumber = parseInt(part);
      if (poolId) {
        whereClause.poolId = poolId;
      }

      // 获取所有不重复的话题
      const categories = await db.questionBank.findMany({
        where: whereClause,
        select: { category: true, partNumber: true },
        distinct: ['category']
      });

      // 按 part 分组
      const groupedCategories: Record<number, string[]> = {
        1: [],
        2: [],
        3: []
      };

      categories.forEach(c => {
        if (groupedCategories[c.partNumber]) {
          groupedCategories[c.partNumber].push(c.category);
        }
      });

      return NextResponse.json({
        success: true,
        categories: groupedCategories
      });
    }

    const whereClause: any = { isActive: true };
    if (part) whereClause.partNumber = parseInt(part);
    if (category) whereClause.category = category;
    if (poolId) {
      whereClause.poolId = poolId;
    } else {
      // 如果没有指定题库，获取默认题库
      const defaultPool = await db.questionPool.findFirst({
        where: { isActive: true, isDefault: true }
      });
      if (defaultPool) {
        whereClause.poolId = defaultPool.id;
      }
    }

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
