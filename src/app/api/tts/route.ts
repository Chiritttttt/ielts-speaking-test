import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice = 'us-female', speed = 1.0 } = body;

    if (!text) {
      return NextResponse.json({
        success: false,
        error: 'No text provided'
      }, { status: 400 });
    }

    // 如果配置了 OpenAI API Key，使用 OpenAI TTS
    if (process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY) {
      const apiKey = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY;
      
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text.substring(0, 4000),
          voice: voice.includes('female') ? 'alloy' : 'echo',
          speed: speed
        })
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        return new NextResponse(audioBuffer, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': audioBuffer.byteLength.toString()
          }
        });
      }
    }

    // 返回提示：TTS 服务未配置
    return NextResponse.json({
      success: false,
      error: 'TTS 服务未配置，请在 .env 文件中设置 OPENAI_API_KEY'
    }, { status: 503 });

  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json({
      success: false,
      error: 'TTS generation failed'
    }, { status: 500 });
  }
}
