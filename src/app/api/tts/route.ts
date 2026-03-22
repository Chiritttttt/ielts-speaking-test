import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

// Edge TTS 命令路径
const EDGE_TTS_PATH = '/home/z/.local/bin/edge-tts';

// 环境变量设置
const EXEC_ENV = {
  ...process.env,
  PATH: `/home/z/.local/bin:/usr/local/bin:${process.env.PATH || ''}`,
  HOME: process.env.HOME || '/home/z'
};

// Edge TTS 语音映射
const EDGE_VOICES: Record<string, string> = {
  'us-female': 'en-US-AriaNeural',
  'us-male': 'en-US-GuyNeural',
  'uk-female': 'en-GB-SoniaNeural',
  'uk-male': 'en-GB-RyanNeural',
  'shimmer': 'en-US-JennyNeural',
  'fable': 'en-GB-MiaNeural'
};

// 处理文本，添加自然停顿标记
function preprocessText(text: string): string {
  // 处理列表项
  let processed = text
    // 处理换行后的列表项，添加逗号让 TTS 停顿
    .replace(/\n[-•]\s*/g, '. ')  // 换行+列表符号 → 句号+空格
    .replace(/\n+/g, '. ')         // 换行 → 句号+空格
    // 移除开头的 "and "（列表项最后一个）
    .replace(/\. and\s+/gi, '. ')
    // 清理多余空格
    .replace(/\s+/g, ' ')
    .trim();
  
  return processed;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice = 'us-female', speed = 0.85 } = body;

    if (!text) {
      return NextResponse.json({
        success: false,
        error: 'No text provided'
      }, { status: 400 });
    }

    const edgeVoice = EDGE_VOICES[voice] || 'en-US-AriaNeural';
    const uuid = randomUUID();
    const outputPath = join(tmpdir(), `tts-${uuid}.mp3`);

    // 计算语速参数 (edge-tts 格式: -50% to +100%)
    const rate = Math.round((speed - 1) * 100);
    const rateArg = rate >= 0 ? `+${rate}%` : `${rate}%`;
    
    // 预处理文本
    const processedText = preprocessText(text.substring(0, 2000));
    
    // 转义双引号
    const escapedText = processedText.replace(/"/g, '\\"');
    
    console.log(`[TTS] Text: "${escapedText.substring(0, 100)}..."`);
    console.log(`[TTS] Voice: ${edgeVoice}, Rate: ${rateArg}`);

    try {
      // 使用 edge-tts 命令行工具
      const command = `${EDGE_TTS_PATH} --voice "${edgeVoice}" --text "${escapedText}" --write-media "${outputPath}" --rate="${rateArg}"`;
      
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 60000, 
        env: EXEC_ENV 
      });
      
      if (stderr && stderr.includes('Error')) {
        console.error('[TTS] stderr:', stderr);
      }

      // 读取生成的音频文件
      const audioBuffer = await readFile(outputPath);
      console.log(`[TTS] Audio generated: ${audioBuffer.byteLength} bytes`);
      
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
    } catch (execError: any) {
      console.error('[TTS] Edge TTS error:', execError.message);
      
      // 清理可能遗留的临时文件
      try {
        await unlink(outputPath);
      } catch {}
      
      return NextResponse.json({
        success: false,
        error: '语音服务暂时不可用，请稍后重试'
      }, { status: 503 });
    }

  } catch (error: any) {
    console.error('[TTS] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'TTS generation failed'
    }, { status: 500 });
  }
}
