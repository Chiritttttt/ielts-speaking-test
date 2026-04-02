import { NextRequest, NextResponse } from 'next/server';
import { recordApiUsage } from '@/lib/usage';

const WHISPER_SERVICE_URL = process.env.WHISPER_SERVICE_URL || 'http://localhost:8001';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audioBase64 } = body;

    if (!audioBase64) {
      return NextResponse.json({
        success: false,
        error: 'No audio data provided'
      }, { status: 400 });
    }

    // Decode base64 to buffer
    const audioBuffer = Buffer.from(audioBase64, 'base64');
    
    // Send to Whisper service
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
    formData.append('audio', audioBlob, 'audio.webm');

    const response = await fetch(`${WHISPER_SERVICE_URL}/transcribe`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Whisper service error:', errorText);
      return NextResponse.json({
        success: false,
        error: `Whisper service error: ${response.status}`
      }, { status: 500 });
    }

    const result = await response.json();
    
    // 记录 Whisper 调用
    recordApiUsage('whisper', 'transcribe', { success: true });
    
    return NextResponse.json({
      success: true,
      transcription: result.text || result.transcription || '',
      engine: 'whisper',
      duration: result.duration
    });
  } catch (error) {
    console.error('Transcribe error:', error);
    return NextResponse.json({
      success: false,
      error: 'Transcription failed'
    }, { status: 500 });
  }
}
