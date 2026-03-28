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

    // 简化的翻译提示词
    const prompt = type === 'modelAnswer'
      ? `Translate this IELTS model answer to Chinese. Keep natural spoken style. Return translation only, no explanation:\n\n"${text}"`
      : `Translate to Chinese. Return translation only:\n\n"${text}"`;

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

    // 获取翻译结果
    let translation = result.content!.trim();
    
    // 清理可能的格式标记
    translation = translation
      .replace(/^["'""]+|["'""]+$/g, '')  // 移除开头结尾的引号
      .replace(/^翻译[：:]\s*/i, '')       // 移除"翻译："前缀
      .replace(/^Translation[：:]\s*/i, '') // 移除"Translation:"前缀
      .trim();

    // 记录成功调用
    recordApiUsage('deepseek', 'translate', { success: true });

    return NextResponse.json({
      success: true,
      translation
    });

  } catch (error) {
    console.error('[Translate] Error:', error);
    return NextResponse.json({
      success: false,
      error: '翻译服务出错'
    }, { status: 500 });
  }
}
