import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callDeepSeek } from '@/lib/deepseek';

/**
 * 获取今日地道表达
 * 如果缓存不存在或超过24小时，则调用 AI 生成新的
 */
export async function GET(request: NextRequest) {
  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // 检查今日是否已有缓存
    const existing = await db.dailyExpression.findUnique({
      where: { date: today }
    });

    if (existing) {
      // 检查是否超过24小时
      const createdTime = existing.createdAt.getTime();
      const now = Date.now();
      const hoursPassed = (now - createdTime) / (1000 * 60 * 60);

      if (hoursPassed < 24) {
        return NextResponse.json({
          success: true,
          expression: existing,
          isCached: true
        });
      }
    }

    // 生成新的地道表达
    const newExpression = await generateDailyExpression(today);

    if (!newExpression) {
      // 如果生成失败，返回缓存（即使过期也比没有好）
      if (existing) {
        return NextResponse.json({
          success: true,
          expression: existing,
          isCached: true,
          warning: '生成新内容失败，显示缓存内容'
        });
      }
      return NextResponse.json({
        success: false,
        error: '生成地道表达失败'
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      expression: newExpression,
      isCached: false
    });
  } catch (error) {
    console.error('[Daily Expression] Error:', error);
    return NextResponse.json({
      success: false,
      error: '获取地道表达失败'
    }, { status: 500 });
  }
}

/**
 * 调用 DeepSeek 生成每日地道表达
 */
async function generateDailyExpression(date: string) {
  const prompt = `Generate a daily IELTS idiomatic expression for Chinese learners. Return ONLY valid JSON with this exact structure:

{
  "expression": "the idiomatic expression in English",
  "meaning": "Chinese translation/meaning (简体中文)",
  "meaningEn": "English explanation of what it means",
  "pronunciation": "pronunciation tips for Chinese speakers (in Chinese)",
  "category": "one of: idiom, collocation, phrasal_verb, slang",
  "usageTips": "tips on how to use it naturally (in Chinese)",
  "part1Example": "Example usage in IELTS Part 1 - English question and answer",
  "part1ExampleCn": "Chinese translation of the Part 1 example",
  "part2Example": "Example usage in IELTS Part 2 - English cue card response snippet",
  "part2ExampleCn": "Chinese translation of the Part 2 example",
  "part3Example": "Example usage in IELTS Part 3 - English question and answer",
  "part3ExampleCn": "Chinese translation of the Part 3 example",
  "commonMistakes": "Common mistakes Chinese learners make (in Chinese)",
  "alternatives": "2-3 alternative expressions with similar meaning and their Chinese meanings"
}

Requirements:
1. Choose an expression that is sophisticated but commonly used in native English
2. The expression should be appropriate for IELTS Speaking (bands 6-8)
3. Examples should be realistic IELTS questions and natural answers
4. Avoid very informal slang or extremely rare expressions
5. All Chinese content should be in Simplified Chinese (简体中文)
6. Examples should clearly show how to use the expression in context

Generate a different expression each time. Today's date is ${date}.`;

  try {
    const result = await callDeepSeek([
      { role: 'user', content: prompt }
    ], { temperature: 0.8, max_tokens: 2500 });

    if (!result.success || !result.content) {
      console.error('[Daily Expression] AI generation failed:', result.error);
      return null;
    }

    // 解析 JSON
    let jsonStr = result.content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }

    const data = JSON.parse(jsonStr);

    // 保存到数据库
    const saved = await db.dailyExpression.create({
      data: {
        date,
        expression: data.expression,
        meaning: data.meaning,
        meaningEn: data.meaningEn || null,
        pronunciation: data.pronunciation || null,
        category: data.category || 'idiom',
        usageTips: data.usageTips || null,
        part1Example: data.part1Example || null,
        part1ExampleCn: data.part1ExampleCn || null,
        part2Example: data.part2Example || null,
        part2ExampleCn: data.part2ExampleCn || null,
        part3Example: data.part3Example || null,
        part3ExampleCn: data.part3ExampleCn || null,
        commonMistakes: data.commonMistakes || null,
        alternatives: data.alternatives || null
      }
    });

    console.log('[Daily Expression] Generated and saved:', saved.expression);
    return saved;
  } catch (error) {
    console.error('[Daily Expression] Parse error:', error);
    return null;
  }
}
