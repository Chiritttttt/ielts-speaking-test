import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callDeepSeek, getEvaluationPrompt } from '@/lib/deepseek';

// 并发评估数量（同时评估几个回答）
const CONCURRENCY_LIMIT = 5;

// 转录数据类型
interface TranscriptionData {
  partNumber?: number;
  questionText: string;
  transcription: string;
  duration?: number;
  audioBase64?: string;
  audioId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, partNumber, transcriptions }: { 
      sessionId?: string; 
      partNumber?: number; 
      transcriptions: TranscriptionData[] 
    } = body;

    console.log('[Evaluate] Starting parallel evaluation:', { 
      sessionId, 
      partNumber, 
      transcriptionCount: transcriptions?.length 
    });

    if (!transcriptions || transcriptions.length === 0) {
      return NextResponse.json({
        success: false,
        error: '没有待评估的回答'
      }, { status: 400 });
    }

    // 检查 API Key 配置
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('[Evaluate] DEEPSEEK_API_KEY not configured');
      return NextResponse.json({
        success: false,
        error: '评估服务未配置，请在 .env 文件中设置 DEEPSEEK_API_KEY'
      }, { status: 503 });
    }

    // 并行评估单个回答
    const evaluateSingle = async (transcription: TranscriptionData, index: number) => {
      const currentPartNumber = transcription.partNumber || partNumber || 1;
      
      console.log(`[Evaluate] Processing ${index + 1}/${transcriptions.length}, Part ${currentPartNumber}`);
      
      const evaluationPrompt = getEvaluationPrompt(currentPartNumber);
      
      const prompt = `${evaluationPrompt}

## Question (Part ${currentPartNumber}):
${transcription.questionText}

## Candidate's Response:
"${transcription.transcription}"

## Response Duration: ${transcription.duration || 30} seconds

Please evaluate this IELTS Speaking response according to Part ${currentPartNumber} requirements. Output only valid JSON without markdown code blocks.`;

      const result = await callDeepSeek([
        { role: 'user', content: prompt }
      ], { temperature: 0.3, max_tokens: 2000 }); // 减少 token 数量加快响应

      if (!result.success || !result.content) {
        console.error(`[Evaluate] API call failed for ${index + 1}:`, result.error);
        return null;
      }

      try {
        let jsonStr = result.content
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        
        const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
        if (jsonMatch) jsonStr = jsonMatch[0];
        
        const evaluation = JSON.parse(jsonStr);

        const roundToHalf = (n: number) => Math.round(n * 2) / 2;
        const scores = {
          fluencyCoherence: roundToHalf(Math.min(9, Math.max(0, Number(evaluation.scores?.fluencyCoherence || 6.0)))),
          lexicalResource: roundToHalf(Math.min(9, Math.max(0, Number(evaluation.scores?.lexicalResource || 6.0)))),
          grammaticalRange: roundToHalf(Math.min(9, Math.max(0, Number(evaluation.scores?.grammaticalRange || 6.0)))),
          pronunciation: roundToHalf(Math.min(9, Math.max(0, Number(evaluation.scores?.pronunciation || 6.0)))),
          overall: 0
        };
        scores.overall = roundToHalf((scores.fluencyCoherence + scores.lexicalResource + scores.grammaticalRange + scores.pronunciation) / 4);

        const feedback = evaluation.feedback || {};
        const modelAnswer = evaluation.modelAnswer || '';

        // 保存到数据库
        let responseRecord;
        try {
          responseRecord = await db.speakingResponse.create({
            data: {
              sessionId: sessionId || 'unknown',
              partNumber: currentPartNumber,
              questionText: transcription.questionText,
              transcription: transcription.transcription,
              duration: transcription.duration,
              audioPath: transcription.audioId || null,
              fluencyScore: scores.fluencyCoherence,
              vocabularyScore: scores.lexicalResource,
              grammarScore: scores.grammaticalRange,
              pronunciationScore: scores.pronunciation,
              overallScore: scores.overall,
              feedback: JSON.stringify(feedback),
              improvements: JSON.stringify(evaluation.improvements || []),
              strengths: JSON.stringify(evaluation.strengths || []),
              modelAnswer: modelAnswer
            }
          });
        } catch (dbError) {
          console.error('[Evaluate] Database error:', dbError);
        }

        console.log(`[Evaluate] Completed ${index + 1}/${transcriptions.length}, score: ${scores.overall}`);

        return {
          id: responseRecord?.id,
          partNumber: currentPartNumber,
          questionText: transcription.questionText,
          transcription: transcription.transcription,
          audioBase64: transcription.audioBase64,
          audioId: transcription.audioId,
          duration: transcription.duration,
          scores,
          feedback,
          improvements: evaluation.improvements || [],
          strengths: evaluation.strengths || [],
          modelAnswer
        };
      } catch (parseError) {
        console.error(`[Evaluate] Parse error for ${index + 1}:`, parseError);
        return null;
      }
    };

    // 分批并行处理
    const results: any[] = [];
    for (let i = 0; i < transcriptions.length; i += CONCURRENCY_LIMIT) {
      const batch = transcriptions.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(
        batch.map((t, batchIndex) => evaluateSingle(t, i + batchIndex))
      );
      results.push(...batchResults.filter(r => r !== null));
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        error: '评估失败，请检查 API 配置或网络连接'
      }, { status: 500 });
    }

    // 计算平均分
    const totalScores = results.reduce((acc, r) => ({
      fluency: acc.fluency + r.scores.fluencyCoherence,
      vocabulary: acc.vocabulary + r.scores.lexicalResource,
      grammar: acc.grammar + r.scores.grammaticalRange,
      pronunciation: acc.pronunciation + r.scores.pronunciation,
      overall: acc.overall + r.scores.overall
    }), { fluency: 0, vocabulary: 0, grammar: 0, pronunciation: 0, overall: 0 });

    const count = results.length;
    const averageScores = {
      fluencyCoherence: totalScores.fluency / count,
      lexicalResource: totalScores.vocabulary / count,
      grammaticalRange: totalScores.grammar / count,
      pronunciation: totalScores.pronunciation / count,
      overall: totalScores.overall / count
    };

    const partBandScore = averageScores.overall;

    console.log('[Evaluate] All evaluations complete:', { 
      resultCount: results.length, 
      partBandScore 
    });

    // 更新会话
    if (sessionId && partNumber === 0) {
      try {
        await db.testSession.update({
          where: { id: sessionId },
          data: {
            status: 'completed',
            completedAt: new Date(),
            bandScore: partBandScore
          }
        });
      } catch (e) {
        console.error('[Evaluate] Session update error:', e);
      }
    }

    return NextResponse.json({
      success: true,
      responses: results,
      averageScores,
      partBandScore
    });
  } catch (error) {
    console.error('[Evaluate] Batch error:', error);
    return NextResponse.json({
      success: false,
      error: '评估服务出错: ' + (error instanceof Error ? error.message : '未知错误')
    }, { status: 500 });
  }
}
