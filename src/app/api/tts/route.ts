import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { recordApiUsage } from '@/lib/usage';

const execAsync = promisify(exec);

// TTS 引擎选择：kokoro | edge
const TTS_ENGINE = process.env.TTS_ENGINE || 'edge';

// Edge TTS 语音映射
const EDGE_VOICES: Record<string, string> = {
  'us-female': 'en-US-AriaNeural',
  'us-male': 'en-US-GuyNeural',
  'uk-female': 'en-GB-SoniaNeural',
  'uk-male': 'en-GB-RyanNeural',
  'shimmer': 'en-US-JennyNeural',
  'fable': 'en-GB-MiaNeural'
};

// Kokoro TTS 语音映射
const KOKORO_VOICES: Record<string, string> = {
  // 英式英语 (British English) - IELTS 推荐
  'uk-female': 'bf_emma',
  'uk-male': 'bm_george',
  'bf_emma': 'bf_emma',
  'bf_isabella': 'bf_isabella',
  'bm_george': 'bm_george',
  'bm_lewis': 'bm_lewis',
  
  // 美式英语 (American English)
  'us-female': 'af_heart',
  'us-male': 'am_michael',
  'af_heart': 'af_heart',
  'af_sarah': 'af_sarah',
  'am_michael': 'am_michael',
  'am_adam': 'am_adam',
  
  // 中文
  'zh-female': 'zf_xiaobei',
  'zh-male': 'zm_yunxi',
  'zf_xiaobei': 'zf_xiaobei',
  'zm_yunxi': 'zm_yunxi',
  
  // 日语
  'ja-female': 'jf_tebukuro',
  'ja-male': 'jm_kumo',
  
  // 印地语
  'hi-female': 'hf_alpha',
  'hi-male': 'hm_omega',
};

// Kokoro 语言代码映射
const KOKORO_LANG_MAP: Record<string, string> = {
  'bf': 'b', 'bm': 'b',  // British English
  'af': 'a', 'am': 'a',  // American English
  'zf': 'z', 'zm': 'z',  // Chinese
  'jf': 'j', 'jm': 'j',  // Japanese
  'hf': 'h', 'hm': 'h',  // Hindi
};

interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
  lang?: string;
}

async function generateKokoroTTS(text: string, voice: string, speed: number, lang?: string): Promise<Buffer> {
  const uuid = randomUUID();
  const outputPath = join(tmpdir(), `kokoro-${uuid}.wav`);
  
  // 确定声音和语言
  const kokoroVoice = KOKORO_VOICES[voice] || voice || 'bf_emma';
  const kokoroLang = lang || KOKORO_LANG_MAP[kokoroVoice.slice(0, 2)] || 'b';
  
  // 创建临时 JSON 输入文件
  const inputPath = join(tmpdir(), `kokoro-input-${uuid}.json`);
  const inputData = {
    text: text.substring(0, 2000),
    output: outputPath,
    voice: kokoroVoice,
    lang: kokoroLang,
    speed: speed
  };
  
  await writeFile(inputPath, JSON.stringify(inputData), 'utf-8');
  
  try {
    // 调用 Python Kokoro 服务 - Windows 兼容方式
    const pythonScript = join(process.cwd(), 'scripts', 'kokoro_service.py');
    
    // 使用 --input-file 参数代替 stdin 重定向（Windows 兼容）
    const { stdout, stderr } = await execAsync(
      `python "${pythonScript}" --input-file "${inputPath}"`,
      { timeout: 120000, maxBuffer: 10 * 1024 * 1024 }  // 增加到 2 分钟超时
    );
    
    // 清理输入文件
    try { await unlink(inputPath); } catch {}
    
    const result = JSON.parse(stdout);
    
    if (!result.success) {
      throw new Error(result.error || 'Kokoro TTS failed');
    }
    
    // 读取生成的音频文件
    const audioBuffer = await readFile(outputPath);
    
    // 清理输出文件
    try { await unlink(outputPath); } catch {}
    
    return audioBuffer;
    
  } catch (error) {
    // 清理临时文件
    try { await unlink(inputPath); } catch {}
    try { await unlink(outputPath); } catch {}
    throw error;
  }
}

async function generateEdgeTTS(text: string, voice: string, speed: number): Promise<Buffer> {
  const edgeVoice = EDGE_VOICES[voice] || 'en-US-AriaNeural';
  const uuid = randomUUID();
  const outputPath = join(tmpdir(), `tts-${uuid}.mp3`);
  
  const rate = Math.round((speed - 1) * 100);
  const rateArg = rate >= 0 ? `+${rate}%` : `${rate}%`;
  
  const processedText = text
    .substring(0, 2000)
    .replace(/\n/g, ' ')
    .replace(/\r/g, '')
    .replace(/"/g, '\\"');
  
  const command = `edge-tts --voice "${edgeVoice}" --text "${processedText}" --write-media "${outputPath}" --rate="${rateArg}"`;
  
  try {
    await execAsync(command, { timeout: 60000 });
    const audioBuffer = await readFile(outputPath);
    try { await unlink(outputPath); } catch {}
    return audioBuffer;
  } catch (error) {
    try { await unlink(outputPath); } catch {}
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TTSRequest = await request.json();
    const { text, voice = 'uk-female', speed = 1.0, lang } = body;

    if (!text) {
      return NextResponse.json({
        success: false,
        error: 'No text provided'
      }, { status: 400 });
    }

    let audioBuffer: Buffer;
    let contentType: string;

    // 根据配置选择 TTS 引擎
    if (TTS_ENGINE === 'kokoro') {
      try {
        audioBuffer = await generateKokoroTTS(text, voice, speed, lang);
        contentType = 'audio/wav';
      } catch (kokoroError) {
        console.error('Kokoro TTS failed, falling back to Edge TTS:', kokoroError);
        // 回退到 Edge TTS
        audioBuffer = await generateEdgeTTS(text, voice, speed);
        contentType = 'audio/mpeg';
      }
    } else {
      // 默认使用 Edge TTS
      audioBuffer = await generateEdgeTTS(text, voice, speed);
      contentType = 'audio/mpeg';
    }

    // 记录 TTS 调用
    recordApiUsage('tts', 'synthesize', { success: true });

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600'
      }
    });

  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json({
      success: false,
      error: 'TTS generation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// 获取可用声音列表
export async function GET() {
  const engine = TTS_ENGINE;
  
  if (engine === 'kokoro') {
    return NextResponse.json({
      engine: 'kokoro',
      voices: [
        { id: 'uk-female', name: 'Emma (British Female)', lang: 'en-GB', recommended: true },
        { id: 'uk-male', name: 'George (British Male)', lang: 'en-GB' },
        { id: 'us-female', name: 'Heart (American Female)', lang: 'en-US', recommended: true },
        { id: 'us-male', name: 'Michael (American Male)', lang: 'en-US' },
        { id: 'bf_emma', name: 'Emma (British Female)', lang: 'en-GB' },
        { id: 'af_heart', name: 'Heart (American Female)', lang: 'en-US' },
        { id: 'zh-female', name: '小贝 (Chinese Female)', lang: 'zh-CN' },
        { id: 'zh-male', name: '云希 (Chinese Male)', lang: 'zh-CN' },
      ]
    });
  }
  
  return NextResponse.json({
    engine: 'edge',
    voices: [
      { id: 'uk-female', name: 'Sonia (British Female)', lang: 'en-GB', recommended: true },
      { id: 'uk-male', name: 'Ryan (British Male)', lang: 'en-GB' },
      { id: 'us-female', name: 'Aria (American Female)', lang: 'en-US' },
      { id: 'us-male', name: 'Guy (American Male)', lang: 'en-US' },
    ]
  });
}
