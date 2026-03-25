import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callDeepSeek } from '@/lib/deepseek';

/**
 * 翻译例句API
 * 点击"查看翻译"时调用，翻译结果缓存到数据库
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { expressionId, part, text } = body;

    if (!expressionId || !part || !text) {
      return NextResponse.json({
        success: false,
        error: '参数不完整'
      }, { status: 400 });
    }

    // 检查数据库中是否已有翻译
    const existing = await db.dailyExpression.findUnique({
      where: { id: expressionId }
    });

    if (!existing) {
      return NextResponse.json({
        success: false,
        error: '表达不存在'
      }, { status: 404 });
    }

    // 检查是否已有缓存的翻译
    let cachedTranslation: string | null = null;
    if (part === '1') cachedTranslation = existing.part1ExampleCn;
    else if (part === '2') cachedTranslation = existing.part2ExampleCn;
    else if (part === '3') cachedTranslation = existing.part3ExampleCn;

    if (cachedTranslation && cachedTranslation.trim()) {
      return NextResponse.json({
        success: true,
        translation: cachedTranslation,
        cached: true
      });
    }

    // 调用 DeepSeek 翻译
    const prompt = `Translate the following IELTS Speaking example to Simplified Chinese (简体中文). 
Keep the translation natural and accurate. Maintain the Q&A format if present.

Example text:
${text}

Return ONLY the Chinese translation, nothing else.`;

    const result = await callDeepSeek([
      { role: 'user', content: prompt }
    ], { temperature: 0.3, max_tokens: 1000 });

    if (!result.success || !result.content) {
      return NextResponse.json({
        success: false,
        error: result.error || '翻译失败'
      }, { status: 500 });
    }

    const translation = result.content.trim();

    // 保存翻译到数据库
    const updateData: any = {};
    if (part === '1') updateData.part1ExampleCn = translation;
    else if (part === '2') updateData.part2ExampleCn = translation;
    else if (part === '3') updateData.part3ExampleCn = translation;

    await db.dailyExpression.update({
      where: { id: expressionId },
      data: updateData
    });

    return NextResponse.json({
      success: true,
      translation,
      cached: false
    });
  } catch (error) {
    console.error('[Translate Example] Error:', error);
    return NextResponse.json({
      success: false,
      error: '翻译失败'
    }, { status: 500 });
  }
}
