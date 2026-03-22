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

    // Map voice ID to language code for TTS
    const voiceMap: Record<string, string> = {
      'us-female': 'en-US',
      'us-male': 'en-US',
      'uk-female': 'en-GB',
      'uk-male': 'en-GB',
      'shimmer': 'en-US',
      'fable': 'en-GB'
    };

    const lang = voiceMap[voice] || 'en-US';
    
    // Use external TTS service or OpenAI TTS if available
    if (process.env.OPENAI_API_KEY) {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text.substring(0, 4000), // Limit text length
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

    // Fallback: Return error indicating TTS not configured
    return NextResponse.json({
      success: false,
      error: 'TTS service not configured'
    }, { status: 503 });

  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json({
      success: false,
      error: 'TTS generation failed'
    }, { status: 500 });
  }
}
