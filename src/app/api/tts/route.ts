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

// 查找 edge-tts 命令
function getEdgeTTSCommand(): string {
  // 优先使用环境变量指定的路径
  if (process.env.EDGE_TTS_PATH) {
    return process.env.EDGE_TTS_PATH;
  }
  
  // 尝试常见的安装位置
  const possiblePaths = [
    '/home/z/.local/bin/edge-tts',
    `${process.env.HOME}/.local/bin/edge-tts`,
    '/usr/local/bin/edge-tts',
    '/usr/bin/edge-tts',
    'edge-tts' // 使用系统 PATH
  ];
  
  // 返回第一个可能存在的路径（在运行时检测）
  return possiblePaths[0];
}

// 处理文本，添加自然停顿
function preprocessText(text: string): string {
  let processed = text
    .replace(/\n[-•]\s*/g, '. ')   // 换行+列表符号 → 句号+空格
    .replace(/\n+/g, '. ')          // 换行 → 句号+空格
    .replace(/\. and\s+/gi, '. ')   // 移除开头的 "and"
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

    // 计算语速参数
    const rate = Math.round((speed - 1) * 100);
    const rateArg = rate >= 0 ? `+${rate}%` : `${rate}%`;
    
    // 预处理文本
    const processedText = preprocessText(text.substring(0, 2000));
    const escapedText = processedText.replace(/"/g, '\\"');
    
    console.log(`[TTS] Text: "${escapedText.substring(0, 100)}..."`);
    console.log(`[TTS] Voice: ${edgeVoice}, Rate: ${rateArg}`);

    // 获取 edge-tts 命令路径
    const edgeTTSPath = process.env.EDGE_TTS_PATH || getEdgeTTSCommand();
    
    // 环境变量
    const execEnv = {
      ...process.env,
      PATH: `${process.env.HOME}/.local/bin:/usr/local/bin:/usr/bin:${process.env.PATH || ''}`
    };

    try {
      const command = `${edgeTTSPath} --voice "${edgeVoice}" --text "${escapedText}" --write-media "${outputPath}" --rate="${rateArg}"`;
      
      console.log(`[TTS] Executing: ${edgeTTSPath}`);
      
      const { stderr } = await execAsync(command, { 
        timeout: 60000, 
        env: execEnv 
      });
      
      if (stderr && stderr.includes('Error')) {
        console.error('[TTS] stderr:', stderr);
      }

      const audioBuffer = await readFile(outputPath);
      console.log(`[TTS] Audio generated: ${audioBuffer.byteLength} bytes`);
      
      try { await unlink(outputPath); } catch {}
      
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString()
        }
      });
    } catch (execError: any) {
      console.error('[TTS] Error:', execError.message);
      
      try { await unlink(outputPath); } catch {}
      
      return NextResponse.json({
        success: false,
        error: '语音服务暂时不可用，请确保已安装 edge-tts',
        details: execError.message
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
