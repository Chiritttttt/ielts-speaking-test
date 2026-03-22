import { NextRequest, NextResponse } from 'next/server';
import ZAI from 'z-ai-web-dev-sdk';

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

    // Initialize ZAI
    const zai = await ZAI.create();

    // Generate speech using z-ai-web-dev-sdk
    const response = await zai.audio.speech.create({
      input: text.substring(0, 4000), // Limit text length
      voice: voice.includes('female') ? 'alloy' : 'echo',
      speed: speed
    });

    // The response contains base64 encoded audio
    if (response && response.data && response.data[0]?.base64) {
      const audioBuffer = Buffer.from(response.data[0].base64, 'base64');
      
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString()
        }
      });
    }

    return NextResponse.json({
      success: false,
      error: 'TTS generation failed'
    }, { status: 500 });

  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json({
      success: false,
      error: 'TTS generation failed'
    }, { status: 500 });
  }
}
