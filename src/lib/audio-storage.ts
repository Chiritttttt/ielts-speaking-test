import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

// 音频存储目录
const AUDIO_DIR = join(process.cwd(), 'audio');

// 确保音频目录存在
export async function ensureAudioDir() {
  if (!existsSync(AUDIO_DIR)) {
    await mkdir(AUDIO_DIR, { recursive: true });
  }
}

// 保存录音文件
export async function saveRecordingAudio(
  sessionId: string,
  responseId: string,
  audioBase64: string
): Promise<string> {
  await ensureAudioDir();
  
  // 移除 data URL 前缀（如果有）
  const base64Data = audioBase64.replace(/^data:audio\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  
  const filename = `recording-${sessionId}-${responseId}.webm`;
  const filepath = join(AUDIO_DIR, filename);
  
  await writeFile(filepath, buffer);
  
  return `/api/audio/${filename}`;
}

// 保存参考回答音频文件
export async function saveModelAnswerAudio(
  sessionId: string,
  responseId: string,
  audioBuffer: Buffer
): Promise<string> {
  await ensureAudioDir();
  
  const filename = `model-${sessionId}-${responseId}.mp3`;
  const filepath = join(AUDIO_DIR, filename);
  
  await writeFile(filepath, audioBuffer);
  
  return `/api/audio/${filename}`;
}

// 读取音频文件
export async function readAudioFile(filename: string): Promise<Buffer> {
  const filepath = join(AUDIO_DIR, filename);
  return await readFile(filepath);
}

// 删除音频文件
export async function deleteAudioFile(filename: string): Promise<void> {
  const filepath = join(AUDIO_DIR, filename);
  try {
    await unlink(filepath);
  } catch {
    // 文件可能不存在，忽略错误
  }
}

// 获取音频文件路径
export function getAudioFilePath(filename: string): string {
  return join(AUDIO_DIR, filename);
}

// 检查音频文件是否存在
export function audioFileExists(filename: string): boolean {
  return existsSync(join(AUDIO_DIR, filename));
}
