import { NextRequest, NextResponse } from 'next/server';
import { readAudioFile, audioFileExists } from '@/lib/audio-storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // 安全检查：防止路径遍历攻击
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
    }
    
    // 检查文件是否存在
    if (!audioFileExists(filename)) {
      return NextResponse.json({ error: 'Audio file not found' }, { status: 404 });
    }
    
    // 读取文件
    const audioBuffer = await readAudioFile(filename);
    
    // 根据扩展名确定 Content-Type
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentType = ext === 'mp3' ? 'audio/mpeg' : 'audio/webm';
    
    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000', // 缓存一年
      },
    });
  } catch (error) {
    console.error('Audio serve error:', error);
    return NextResponse.json({ error: 'Failed to read audio file' }, { status: 500 });
  }
}
