import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callDeepSeek } from '@/lib/deepseek';

// 获取北京时间日期字符串 (YYYY-MM-DD)
function getBeijingDate(): string {
  const now = new Date();
  // 先转换为 UTC，再加 8 小时得到北京时间（无论服务器时区是什么）
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijingTime = new Date(utcTime + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().split('T')[0];
}

// 检查是否应该更新（北京时间早上8点后）
// 使用 updatedAt 而不是 createdAt，因为更新后 createdAt 不会变
function shouldUpdate(updatedAt: Date): boolean {
  const now = new Date();
  
  // 先转换为 UTC，再加 8 小时得到北京时间（无论服务器时区是什么）
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijingTime = new Date(utcTime + 8 * 60 * 60 * 1000);
  const beijingDate = beijingTime.toISOString().split('T')[0]; // 例如 "2024-01-15"
  
  // 北京时间今天早上8点 = UTC 今天午夜0点
  // 例如：北京时间 2024-01-15 08:00 = UTC 2024-01-15 00:00
  const today8AMBeijing = new Date(beijingDate + 'T00:00:00.000Z');
  
  // 直接比较：如果最后更新时间在北京时间今天8点之前，需要更新
  return updatedAt < today8AMBeijing;
}

/**
 * 获取今日地道表达
 * 每天北京时间早上8点更新
 */
export async function GET(request: NextRequest) {
  try {
    const today = getBeijingDate();

    // 检查今日是否已有缓存
    const existing = await db.dailyExpression.findUnique({
      where: { date: today }
    });

    if (existing) {
      // 检查是否需要更新（早上8点后）- 使用 updatedAt 判断
      if (!shouldUpdate(existing.updatedAt)) {
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
 * 整个词条都会更新，翻译按需生成
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
  "part2Example": "Example usage in IELTS Part 2 - English cue card response snippet",
  "part3Example": "Example usage in IELTS Part 3 - English question and answer",
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
    ], { temperature: 0.8, max_tokens: 2000 });

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

    // 检查是否已有该日期的记录
    const existing = await db.dailyExpression.findUnique({
      where: { date }
    });

    let saved;
    if (existing) {
      // 更新现有记录（整个词条都更新）
      saved = await db.dailyExpression.update({
        where: { date },
        data: {
          expression: data.expression,
          meaning: data.meaning,
          meaningEn: data.meaningEn || null,
          pronunciation: data.pronunciation || null,
          category: data.category || 'idiom',
          usageTips: data.usageTips || null,
          part1Example: data.part1Example || null,
          part1ExampleCn: null, // 翻译按需生成
          part2Example: data.part2Example || null,
          part2ExampleCn: null,
          part3Example: data.part3Example || null,
          part3ExampleCn: null,
          commonMistakes: data.commonMistakes || null,
          alternatives: data.alternatives || null,
          updatedAt: new Date()
        }
      });
      console.log('[Daily Expression] Updated for date:', date);
    } else {
      // 创建新记录
      saved = await db.dailyExpression.create({
        data: {
          date,
          expression: data.expression,
          meaning: data.meaning,
          meaningEn: data.meaningEn || null,
          pronunciation: data.pronunciation || null,
          category: data.category || 'idiom',
          usageTips: data.usageTips || null,
          part1Example: data.part1Example || null,
          part1ExampleCn: null,
          part2Example: data.part2Example || null,
          part2ExampleCn: null,
          part3Example: data.part3Example || null,
          part3ExampleCn: null,
          commonMistakes: data.commonMistakes || null,
          alternatives: data.alternatives || null
        }
      });
      console.log('[Daily Expression] Created for date:', date);
    }

    return saved;
  } catch (error) {
    console.error('[Daily Expression] Parse error:', error);
    return null;
  }
}
