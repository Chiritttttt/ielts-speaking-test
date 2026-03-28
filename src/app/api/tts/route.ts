import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { recordApiUsage } from '@/lib/usage';

const execAsync = promisify(exec);

// Edge TTS 语音映射 - 支持多种英语口音
const EDGE_VOICES: Record<string, string> = {
  // 英式英语
  'uk-female': 'en-GB-SoniaNeural',
  'uk-male': 'en-GB-RyanNeural',
  
  // 美式英语
  'us-female': 'en-US-AriaNeural',
  'us-male': 'en-US-GuyNeural',
  
  // 澳大利亚英语
  'au-female': 'en-AU-NatashaNeural',
  'au-male': 'en-AU-WilliamNeural',
  
  // 印度英语
  'in-female': 'en-IN-NeerjaNeural',
  'in-male': 'en-IN-PrabhatNeural',
  
  // 爱尔兰英语
  'ie-female': 'en-IE-EmilyNeural',
  'ie-male': 'en-IE-ConnorNeural',
  
  // 新西兰英语
  'nz-female': 'en-NZ-MollyNeural',
  'nz-male': 'en-NZ-MitchellNeural',
  
  // 南非英语
  'za-female': 'en-ZA-LeahNeural',
  'za-male': 'en-ZA-LukeNeural',
  
  // 加拿大英语
  'ca-female': 'en-CA-ClaraNeural',
  'ca-male': 'en-CA-LiamNeural',
};

interface TTSRequest {
  text: string;
  voice?: string;
  speed?: number;
}

async function generateEdgeTTS(text: string, voice: string, speed: number): Promise<Buffer> {
  const edgeVoice = EDGE_VOICES[voice] || 'en-GB-SoniaNeural';
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
    const { text, voice = 'uk-female', speed = 1.0 } = body;

    if (!text) {
      return NextResponse.json({
        success: false,
        error: 'No text provided'
      }, { status: 400 });
    }

    const audioBuffer = await generateEdgeTTS(text, voice, speed);

    // 记录 TTS 调用
    recordApiUsage('tts', 'synthesize', { success: true });

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
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
  return NextResponse.json({
    engine: 'edge',
    voices: [
      // 英式英语 - IELTS 推荐
      { id: 'uk-female', name: 'Sonia (British Female)', lang: 'en-GB', recommended: true },
      { id: 'uk-male', name: 'Ryan (British Male)', lang: 'en-GB' },
      
      // 美式英语
      { id: 'us-female', name: 'Aria (American Female)', lang: 'en-US' },
      { id: 'us-male', name: 'Guy (American Male)', lang: 'en-US' },
      
      // 澳大利亚英语
      { id: 'au-female', name: 'Natasha (Australian Female)', lang: 'en-AU' },
      { id: 'au-male', name: 'William (Australian Male)', lang: 'en-AU' },
      
      // 印度英语
      { id: 'in-female', name: 'Neerja (Indian Female)', lang: 'en-IN' },
      { id: 'in-male', name: 'Prabhat (Indian Male)', lang: 'en-IN' },
      
      // 爱尔兰英语
      { id: 'ie-female', name: 'Emily (Irish Female)', lang: 'en-IE' },
      { id: 'ie-male', name: 'Connor (Irish Male)', lang: 'en-IE' },
      
      // 新西兰英语
      { id: 'nz-female', name: 'Molly (New Zealand Female)', lang: 'en-NZ' },
      { id: 'nz-male', name: 'Mitchell (New Zealand Male)', lang: 'en-NZ' },
      
      // 南非英语
      { id: 'za-female', name: 'Leah (South African Female)', lang: 'en-ZA' },
      { id: 'za-male', name: 'Luke (South African Male)', lang: 'en-ZA' },
      
      // 加拿大英语
      { id: 'ca-female', name: 'Clara (Canadian Female)', lang: 'en-CA' },
      { id: 'ca-male', name: 'Liam (Canadian Male)', lang: 'en-CA' },
    ]
  });
}
