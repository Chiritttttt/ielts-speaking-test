import { NextRequest, NextResponse } from 'next/server';
import { callDeepSeek } from '@/lib/deepseek';

/**
 * 语法修改 API - 按需调用，精简 prompt 节省 token
 */
export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({
        success: false,
        error: '请提供需要修改的文本'
      }, { status: 400 });
    }

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({
        success: false,
        error: 'API 未配置'
      }, { status: 503 });
    }

    // 精简 prompt，节省 token
    const prompt = `Fix grammar errors in this IELTS speaking response. Return JSON only:
{"corrected": "<corrected text>", "errors": [{"original": "<wrong>", "corrected": "<right>", "explanation": "<简短中文解释>"}]}

Text: "${text}"`;

    const result = await callDeepSeek([
      { role: 'user', content: prompt }
    ], { temperature: 0.2, max_tokens: 1500 });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || '语法修改失败'
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

    return NextResponse.json({
      success: true,
      corrected: data.corrected,
      errors: data.errors || []
    });

  } catch (error) {
    console.error('[Grammar Fix] Error:', error);
    return NextResponse.json({
      success: false,
      error: '语法修改服务出错'
    }, { status: 500 });
  }
}
