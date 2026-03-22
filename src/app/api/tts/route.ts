import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink, access } from 'fs/promises';
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

// 缓存找到的 edge-tts 路径
let cachedEdgeTTSPath: string | null = null;

// 查找 edge-tts 命令（异步检测文件是否存在）
async function findEdgeTTS(): Promise<string | null> {
  if (cachedEdgeTTSPath) return cachedEdgeTTSPath;
  
  // 优先使用环境变量指定的路径
  if (process.env.EDGE_TTS_PATH) {
    try {
      await access(process.env.EDGE_TTS_PATH);
      cachedEdgeTTSPath = process.env.EDGE_TTS_PATH;
      console.log('[TTS] Using EDGE_TTS_PATH:', cachedEdgeTTSPath);
      return cachedEdgeTTSPath;
    } catch {
      console.warn('[TTS] EDGE_TTS_PATH set but file not found:', process.env.EDGE_TTS_PATH);
    }
  }
  
  // 尝试常见的安装位置
  const possiblePaths = [
    '/home/z/.local/bin/edge-tts',
    '/root/.local/bin/edge-tts',
    '/usr/local/bin/edge-tts',
    '/usr/bin/edge-tts',
    `${process.env.HOME}/.local/bin/edge-tts`,
  ];
  
  for (const path of possiblePaths) {
    try {
      await access(path);
      cachedEdgeTTSPath = path;
      console.log('[TTS] Found edge-tts at:', cachedEdgeTTSPath);
      return cachedEdgeTTSPath;
    } catch {
      // 继续尝试下一个路径
    }
  }
  
  // 最后尝试使用系统 PATH 中的 edge-tts
  try {
    const { stdout } = await execAsync('which edge-tts', { timeout: 5000 });
    const path = stdout.trim();
    if (path) {
      cachedEdgeTTSPath = path;
      console.log('[TTS] Found edge-tts via which:', cachedEdgeTTSPath);
      return cachedEdgeTTSPath;
    }
  } catch {
    // which 命令失败
  }
  
  console.error('[TTS] edge-tts not found in any location');
  return null;
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

    // 获取 edge-tts 命令路径（动态检测）
    const edgeTTSPath = await findEdgeTTS();
    
    if (!edgeTTSPath) {
      console.error('[TTS] edge-tts not found');
      return NextResponse.json({
        success: false,
        error: '语音服务不可用：未找到 edge-tts，请联系管理员安装',
        hint: 'pip3 install edge-tts'
      }, { status: 503 });
    }
    
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
