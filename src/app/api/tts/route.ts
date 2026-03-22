import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

// Edge TTS 命令路径（优先使用 .local/bin，否则使用系统 PATH）
const EDGE_TTS_CMD = process.env.EDGE_TTS_CMD || '/home/z/.local/bin/edge-tts';

// 环境变量设置，确保 PATH 包含 .local/bin
const EXEC_ENV = {
  ...process.env,
  PATH: `/home/z/.local/bin:${process.env.PATH || ''}`
};

// Edge TTS 语音映射
const EDGE_VOICES: Record<string, string> = {
  'us-female': 'en-US-AriaNeural',
  'us-male': 'en-US-GuyNeural',
  'uk-female': 'en-GB-SoniaNeural',
  'uk-male': 'en-GB-RyanNeural',
  'shimmer': 'en-US-JennyNeural',
  'fable': 'en-GB-MiaNeural'
};

// 停顿时长配置（毫秒）
const PAUSE_DURATIONS = {
  sentence: 600,    // 句号、问号、感叹号后的停顿（增加）
  clause: 400,      // 分号、冒号后的停顿（增加）
  listItem: 500,    // 列表项之间的停顿（增加）
  shortText: 300    // 短句之间的停顿（增加）
};

// 句子元数据
interface SentenceInfo {
  text: string;
  isListItem: boolean;
  endsWithColon: boolean;
}

// 将文本分割成句子（带元数据）
function splitIntoSentencesWithMeta(text: string): SentenceInfo[] {
  const parts: SentenceInfo[] = [];
  
  // 按换行符先分割（常见于 Part 2 题目）
  const lines = text.split(/\n+/).filter(line => line.trim());
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 特殊处理列表项（以 "- " 开头）
    if (/^[-•]\s/.test(trimmedLine)) {
      // 列表项作为单独的一句话处理
      // 移除开头的 "- " 或 "• "
      let itemText = trimmedLine.replace(/^[-•]\s*/, '');
      
      // 移除开头的 "and "（常见于最后一个列表项如 "- and explain..."）
      if (/^and\s+/i.test(itemText)) {
        itemText = itemText.replace(/^and\s+/i, '');
      }
      
      parts.push({
        text: itemText,
        isListItem: true,
        endsWithColon: false
      });
      continue;
    }
    
    // 处理 "You should say:" 这种格式
    if (trimmedLine.endsWith(':')) {
      // 冒号结尾的行作为单独一句话
      parts.push({
        text: trimmedLine,
        isListItem: false,
        endsWithColon: true
      });
      continue;
    }
    
    // 普通行：按句子分割
    // 匹配：句号、问号、感叹号后跟空格和大写字母（或行尾）
    const sentences = trimmedLine
      .split(/(?<=[.!?])\s+(?=[A-Z])/)
      .filter(s => s.trim());
    
    if (sentences.length > 0) {
      for (const s of sentences) {
        parts.push({
          text: s.trim(),
          isListItem: false,
          endsWithColon: false
        });
      }
    } else if (trimmedLine) {
      parts.push({
        text: trimmedLine,
        isListItem: false,
        endsWithColon: false
      });
    }
  }
  
  return parts;
}

// 判断是否需要添加停顿
function getPauseAfterSentence(info: SentenceInfo): number {
  if (info.isListItem) {
    return PAUSE_DURATIONS.listItem;
  }
  if (info.endsWithColon) {
    return PAUSE_DURATIONS.clause;
  }
  
  const text = info.text.trim();
  if (text.endsWith('.') || text.endsWith('!') || text.endsWith('?')) {
    return PAUSE_DURATIONS.sentence;
  }
  if (text.endsWith(':') || text.endsWith(';')) {
    return PAUSE_DURATIONS.clause;
  }
  return PAUSE_DURATIONS.shortText;
}

// 生成静音音频文件（使用 ffmpeg）
async function generateSilence(durationMs: number, outputPath: string): Promise<void> {
  const durationSec = durationMs / 1000;
  const command = `ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t ${durationSec} -y "${outputPath}"`;
  await execAsync(command, { timeout: 10000 });
}

// 合并多个音频文件（使用 ffmpeg）
async function concatenateAudioFiles(inputFiles: string[], outputPath: string): Promise<void> {
  if (inputFiles.length === 0) {
    throw new Error('No audio files to concatenate');
  }
  
  if (inputFiles.length === 1) {
    // 只有一个文件，直接复制
    const { rename } = await import('fs/promises');
    await rename(inputFiles[0], outputPath);
    return;
  }
  
  // 创建文件列表
  const listFile = join(tmpdir(), `concat-${randomUUID()}.txt`);
  const fileListContent = inputFiles.map(f => `file '${f}'`).join('\n');
  await writeFile(listFile, fileListContent);
  
  try {
    const command = `ffmpeg -f concat -safe 0 -i "${listFile}" -c copy -y "${outputPath}"`;
    await execAsync(command, { timeout: 60000 });
  } finally {
    // 清理列表文件
    try {
      await unlink(listFile);
    } catch {}
  }
}

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

    const edgeVoice = EDGE_VOICES[voice] || 'en-US-AriaNeural';
    const uuid = randomUUID();
    const finalOutputPath = join(tmpdir(), `tts-${uuid}.mp3`);
    
    // 使用 edge-tts 命令行工具
    const rate = Math.round((speed - 1) * 100);
    const rateArg = rate >= 0 ? `+${rate}%` : `${rate}%`;
    
    // 处理文本：移除回车符，保留换行符用于句子分割
    const processedText = text
      .substring(0, 2000)
      .replace(/\r/g, '');   // 移除回车符
    
    // 分割句子（带元数据）
    const sentenceInfos = splitIntoSentencesWithMeta(processedText);
    const needsPauses = sentenceInfos.length > 1;
    
    try {
      if (needsPauses) {
        // 多句子文本：逐句生成音频并添加停顿
        console.log(`[TTS] Processing ${sentenceInfos.length} sentences with pauses`);
        
        const audioFiles: string[] = [];
        const cleanupFiles: string[] = [];
        
        try {
          for (let i = 0; i < sentenceInfos.length; i++) {
            const info = sentenceInfos[i];
            const sentence = info.text.trim();
            if (!sentence) continue;
            
            // 生成句子音频
            const sentenceFile = join(tmpdir(), `tts-${uuid}-${i}.mp3`);
            cleanupFiles.push(sentenceFile);
            
            // 转义双引号用于命令行
            const escapedSentence = sentence
              .replace(/\n/g, ' ')
              .replace(/"/g, '\\"');
            
            const command = `${EDGE_TTS_CMD} --voice "${edgeVoice}" --text "${escapedSentence}" --write-media "${sentenceFile}" --rate="${rateArg}"`;
            await execAsync(command, { timeout: 30000, env: EXEC_ENV });
            
            audioFiles.push(sentenceFile);
            
            // 添加停顿（除了最后一个句子）
            if (i < sentenceInfos.length - 1) {
              const pauseDuration = getPauseAfterSentence(info);
              const pauseFile = join(tmpdir(), `tts-${uuid}-pause-${i}.mp3`);
              cleanupFiles.push(pauseFile);
              
              await generateSilence(pauseDuration, pauseFile);
              audioFiles.push(pauseFile);
            }
          }
          
          // 合并所有音频
          if (audioFiles.length > 0) {
            await concatenateAudioFiles(audioFiles, finalOutputPath);
          } else {
            throw new Error('No audio files generated');
          }
        } finally {
          // 清理临时文件
          for (const file of cleanupFiles) {
            try {
              await unlink(file);
            } catch {}
          }
        }
      } else {
        // 单句文本：直接生成
        const simpleOutputPath = join(tmpdir(), `tts-${uuid}-simple.mp3`);
        // 转义双引号用于命令行
        const escapedText = processedText.replace(/"/g, '\\"');
        const command = `${EDGE_TTS_CMD} --voice "${edgeVoice}" --text "${escapedText}" --write-media "${simpleOutputPath}" --rate="${rateArg}"`;
        await execAsync(command, { timeout: 60000, env: EXEC_ENV });
        
        // 重命名为最终输出路径
        const { rename } = await import('fs/promises');
        await rename(simpleOutputPath, finalOutputPath);
      }
      
      const audioBuffer = await readFile(finalOutputPath);
      
      // 清理最终临时文件
      try {
        await unlink(finalOutputPath);
      } catch {}
      
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': audioBuffer.byteLength.toString()
        }
      });
    } catch (execError) {
      console.error('Edge TTS exec error:', execError);
      
      // 清理可能遗留的临时文件
      try {
        await unlink(finalOutputPath);
      } catch {}
      
      // 如果 edge-tts 命令失败，返回错误
      return NextResponse.json({
        success: false,
        error: 'Edge TTS 服务不可用，请确保已安装 edge-tts: pip install edge-tts'
      }, { status: 503 });
    }

  } catch (error) {
    console.error('TTS error:', error);
    return NextResponse.json({
      success: false,
      error: 'TTS generation failed'
    }, { status: 500 });
  }
}
