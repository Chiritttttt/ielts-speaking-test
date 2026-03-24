import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

// Edge TTS 语音映射
const EDGE_VOICES: Record<string, string> = {
  'us-female': 'en-US-AriaNeural',
  'us-male': 'en-US-GuyNeural',
  'uk-female': 'en-GB-SoniaNeural',
  'uk-male': 'en-GB-RyanNeural',
  'shimmer': 'en-US-JennyNeural',
  'fable': 'en-GB-MiaNeural'
};

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

    const edgeVoice = EDGE_VOICES[voice] || 'en-US-AriaNeural';
    const uuid = randomUUID();
    const outputPath = join(tmpdir(), `tts-${uuid}.mp3`);

    // 使用 edge-tts 命令行工具
    const rate = Math.round((speed - 1) * 100);
    const rateArg = rate >= 0 ? `+${rate}%` : `${rate}%`;
    
    // 处理文本：将换行符替换为空格，并转义特殊字符
    const processedText = text
      .substring(0, 2000)
      .replace(/\n/g, ' ')  // 换行符替换为空格
      .replace(/\r/g, '')   // 移除回车符
      .replace(/"/g, '\\"'); // 只转义双引号（单引号/撇号不需要转义，因为在双引号内）
    
    const command = `edge-tts --voice "${edgeVoice}" --text "${processedText}" --write-media "${outputPath}" --rate="${rateArg}"`;

    try {
      await execAsync(command, { timeout: 60000 });  // 增加超时时间到60秒
      
      const audioBuffer = await readFile(outputPath);
      
      // 清理临时文件
      try {
        await unlink(outputPath);
      } catch {}
      
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString()
        }
      });
    } catch (execError) {
      console.error('Edge TTS exec error:', execError);
      
      // 如果 edge-tts 命令失败，返回错误
      return NextResponse.json({
        success: false,
        error: 'Edge TTS 服务不可用，请确保已安装 edge-tts: pip install edge-tts'
      }, { status: 503 });
    }

  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json({
      success: false,
      error: 'TTS generation failed'
    }, { status: 500 });
  }
}
