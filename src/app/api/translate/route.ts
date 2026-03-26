import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/deepseek';
import { recordApiUsage } from '@/lib/usage';

/**
 * 翻译 API - 英文翻译成中文，按需调用，精简 prompt 节省 token
 */
export async function POST(request: NextRequest) {
  try {
    const { text, type = 'transcription' } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({
        success: false,
        error: '请提供需要翻译的文本'
      }, { status: 400 });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('[Translate] DEEPSEEK_API_KEY not configured');
      return NextResponse.json({
        success: false,
        error: '翻译服务未配置'
      }, { status: 503 });
    }

    // 根据类型选择不同的翻译风格
    let prompt: string;
    if (type === 'modelAnswer') {
      // 模型答案翻译 - 保留口语化风格
      prompt = `Translate this IELTS model answer to Chinese. Keep natural spoken style.
{"translation": "<中文翻译>"}

Text: "${text}"`;
    } else {
      // 用户回答翻译 - 直译为主
      prompt = `Translate to Chinese. Return JSON only:
{"translation": "<中文翻译>"}

Text: "${text}"`;
    }

    const result = await callDeepSeek([
      { role: 'user', content: prompt }
    ], { temperature: 0.2, max_tokens: 1000 });

    if (!result.success) {
      console.error('[Translate] DeepSeek error:', result.error);
      recordApiUsage('deepseek', 'translate', { success: false });
      return NextResponse.json({
        success: false,
        error: result.error || '翻译服务暂时不可用'
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

    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('[Translate] JSON parse error:', parseError, 'Content:', jsonStr.substring(0, 200));
      recordApiUsage('deepseek', 'translate', { success: false });
      return NextResponse.json({
        success: false,
        error: '翻译结果解析失败'
      }, { status: 500 });
    }

    if (!data.translation) {
      console.error('[Translate] No translation in response:', data);
      recordApiUsage('deepseek', 'translate', { success: false });
      return NextResponse.json({
        success: false,
        error: '翻译结果格式错误'
      }, { status: 500 });
    }

    // 记录成功调用
    recordApiUsage('deepseek', 'translate', { success: true });

    return NextResponse.json({
      success: true,
      translation: data.translation
    });

  } catch (error) {
    console.error('[Translate] Error:', error);
    return NextResponse.json({
      success: false,
      error: '翻译服务出错'
    }, { status: 500 });
  }
}
