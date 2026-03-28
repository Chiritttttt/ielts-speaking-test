import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { recordApiUsage } from '@/lib/usage';

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
      { id: 'uk-female', name: 'Sonia (British Female)', lang: 'en-GB', recommended: true },
      { id: 'uk-male', name: 'Ryan (British Male)', lang: 'en-GB' },
      { id: 'us-female', name: 'Aria (American Female)', lang: 'en-US' },
      { id: 'us-male', name: 'Guy (American Male)', lang: 'en-US' },
    ]
  });
}
