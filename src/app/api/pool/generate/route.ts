import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/deepseek';
import { db } from '@/lib/db';

/**
 * 自动生成题目并添加到题库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { poolId, partNumber, topic, count = 5 } = body;

    if (!poolId) {
      return NextResponse.json({
        success: false,
        error: '请指定目标题库'
      }, { status: 400 });
    }

    if (!partNumber || ![1, 2, 3].includes(partNumber)) {
      return NextResponse.json({
        success: false,
        error: '请指定有效的 Part (1, 2, 3)'
      }, { status: 400 });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'API 未配置'
      }, { status: 503 });
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

    // 根据不同 Part 生成题目
    const prompts: Record<number, string> = {
      1: `Generate ${count} IELTS Speaking Part 1 questions about "${topic}".
Part 1 questions should be:
- Personal, everyday topics
- Simple present tense, about "you"
- 8-15 words per question
- Progressive difficulty: identity → preferences → changes

Return JSON only:
{"questions": [{"question": "<question text>", "difficulty": "easy|medium|hard", "category": "<category>"}]}`,

      2: `Generate ${count} IELTS Speaking Part 2 cue card topics about "${topic}".
Part 2 format:
- "Describe a/the..." opening
- "You should say:" with 4 bullet points
- Bullet points: what/who/when/where, details, feelings/explanation

Return JSON only:
{"questions": [{"question": "Describe [topic].\\n\\nYou should say:\\n- [bullet 1]\\n- [bullet 2]\\n- [bullet 3]\\n- and explain [bullet 4]", "difficulty": "medium", "category": "<category>"}]}`,

      3: `Generate ${count} IELTS Speaking Part 3 discussion questions about "${topic}".
Part 3 questions should be:
- Abstract, social-level topics
- Compare, evaluate, speculate
- 10-20 words per question
- Progressive: specific → broader → abstract

Return JSON only:
{"questions": [{"question": "<question text>", "difficulty": "easy|medium|hard", "category": "<category>"}]}`
    };

    const result = await callDeepSeek([
      { role: 'user', content: prompts[partNumber] }
    ], { temperature: 0.7, max_tokens: 3000 });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || '生成题目失败'
      }, { status: 500 });
    }

    // 解析 JSON
    let jsonStr = result.content!
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const data = JSON.parse(jsonStr);
    const questions = data.questions || [];

    if (questions.length === 0) {
      return NextResponse.json({
        success: false,
        error: '未能生成有效题目'
      }, { status: 500 });
    }

    // 保存到数据库
    const formattedQuestions = questions.map((q: any) => ({
      partNumber,
      category: q.category || topic,
      questionText: q.question,
      difficulty: q.difficulty || 'medium',
      isActive: true,
      poolId
    }));

    await db.questionBank.createMany({
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
        source: 'ai'
      }
    });

    return NextResponse.json({
      success: true,
      generated: questions.length,
      questions: formattedQuestions
    });
  } catch (error) {
    console.error('[Pool Generate] Error:', error);
    return NextResponse.json({
      success: false,
      error: '生成题目失败'
    }, { status: 500 });
  }
}
