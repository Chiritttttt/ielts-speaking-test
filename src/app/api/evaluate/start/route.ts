import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { db } from '@/lib/db';

// 并发评估数量
const CONCURRENCY_LIMIT = 5;

// 启动后台评估 - 立即返回，评估在后台进行
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, transcriptions } = body;

    console.log('[EvaluateStart] Starting evaluation for session:', sessionId, 'transcriptions:', transcriptions?.length);

    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: '缺少 sessionId'
      }, { status: 400 });
    }

    if (!transcriptions || transcriptions.length === 0) {
      return NextResponse.json({
        success: false,
        error: '没有待评估的回答'
      }, { status: 400 });
    }

    // 检查 API Key 配置
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({
        success: false,
        error: '评估服务未配置'
      }, { status: 503 });
    }

    // 更新会话状态为评估中
    await db.testSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        evaluationStatus: 'evaluating',
        evaluationProgress: 0,
        evaluationMessage: '准备评估...',
        completedAt: new Date()
      }
    });

    // 保存待评估的转录到临时存储
    await db.speakingResponse.deleteMany({
      where: { sessionId }
    });

    for (const t of transcriptions) {
      await db.speakingResponse.create({
        data: {
          sessionId,
          partNumber: t.partNumber || 1,
          questionText: t.questionText,
          transcription: t.transcription,
          duration: t.duration,
          audioPath: t.audioId || null,
          fluencyScore: null,
          vocabularyScore: null,
          grammarScore: null,
          pronunciationScore: null,
          overallScore: null,
          feedback: JSON.stringify({ status: 'pending' }),
          improvements: '[]',
          strengths: '[]',
          modelAnswer: ''
        }
      });
    }

    // 使用 Next.js 15 的 after API 确保后台任务在响应发送后执行
    after(async () => {
      console.log('[EvaluateStart] Starting background evaluation after response');
      try {
        await runBackgroundEvaluation(sessionId, transcriptions);
      } catch (error) {
        console.error('[EvaluateStart] Background evaluation failed:', error);
        try {
          await db.testSession.update({
            where: { id: sessionId },
            data: {
              evaluationStatus: 'failed',
              evaluationMessage: '评估失败: ' + (error instanceof Error ? error.message : '未知错误')
            }
          });
        } catch (e) {
          console.error('[EvaluateStart] Failed to update error status:', e);
        }
      }
    });

    return NextResponse.json({
      success: true,
      message: '评估已在后台启动',
      sessionId
    });
  } catch (error) {
    console.error('[EvaluateStart] Error:', error);
    return NextResponse.json({
      success: false,
      error: '启动评估失败: ' + (error instanceof Error ? error.message : '未知错误')
    }, { status: 500 });
  }
}

// 后台评估函数 - 并行评估
async function runBackgroundEvaluation(sessionId: string, transcriptions: any[]) {
  const { callDeepSeek, getEvaluationPrompt } = await import('@/lib/deepseek');
  
  console.log('[BackgroundEval] Starting parallel evaluation for session:', sessionId);
  
  const total = transcriptions.length;
  let successCount = 0;
  let totalScores = { fluency: 0, vocabulary: 0, grammar: 0, pronunciation: 0, overall: 0 };

  // 评估单个回答
  const evaluateSingle = async (t: any, index: number) => {
    const partNumber = t.partNumber || 1;

    try {
      const evaluationPrompt = getEvaluationPrompt(partNumber);
      const prompt = `${evaluationPrompt}

## Question (Part ${partNumber}):
${t.questionText}

## Candidate's Response:
"${t.transcription}"

## Response Duration: ${t.duration || 30} seconds

Please evaluate this IELTS Speaking response according to Part ${partNumber} requirements. Output only valid JSON without markdown code blocks.`;

      const result = await callDeepSeek([
        { role: 'user', content: prompt }
      ], { temperature: 0.3, max_tokens: 2000 });

      if (result.success && result.content) {
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

        // 更新数据库中的评估结果
        await db.speakingResponse.updateMany({
          where: {
            sessionId,
            questionText: t.questionText,
            transcription: t.transcription
          },
          data: {
            fluencyScore: scores.fluencyCoherence,
            vocabularyScore: scores.lexicalResource,
            grammarScore: scores.grammaticalRange,
            pronunciationScore: scores.pronunciation,
            overallScore: scores.overall,
            feedback: JSON.stringify(evaluation.feedback || {}),
            improvements: JSON.stringify(evaluation.improvements || []),
            strengths: JSON.stringify(evaluation.strengths || []),
            modelAnswer: evaluation.modelAnswer || ''
          }
        });

        console.log(`[BackgroundEval] Evaluated ${index + 1}/${total} successfully, score: ${scores.overall}`);
        return { success: true, scores };
      }
    } catch (error) {
      console.error(`[BackgroundEval] Error evaluating response ${index + 1}:`, error);
    }
    return { success: false };
  };

  // 分批并行处理，每批 CONCURRENCY_LIMIT 个
  for (let i = 0; i < transcriptions.length; i += CONCURRENCY_LIMIT) {
    const batch = transcriptions.slice(i, i + CONCURRENCY_LIMIT);
    const batchResults = await Promise.all(
      batch.map((t, batchIndex) => evaluateSingle(t, i + batchIndex))
    );

    // 统计成功的评估
    for (const result of batchResults) {
      if (result.success && result.scores) {
        successCount++;
        totalScores.fluency += result.scores.fluencyCoherence;
        totalScores.vocabulary += result.scores.lexicalResource;
        totalScores.grammar += result.scores.grammaticalRange;
        totalScores.pronunciation += result.scores.pronunciation;
        totalScores.overall += result.scores.overall;
      }
    }

    // 更新进度
    const progress = Math.round(((i + batch.length) / total) * 100);
    try {
      await db.testSession.update({
        where: { id: sessionId },
        data: {
          evaluationProgress: progress,
          evaluationMessage: `正在评估... (${Math.min(i + batch.length, total)}/${total})`
        }
      });
    } catch (e) {
      console.error('[BackgroundEval] Failed to update progress:', e);
    }
  }

  if (successCount > 0) {
    const avgOverall = totalScores.overall / successCount;

    await db.testSession.update({
      where: { id: sessionId },
      data: {
        evaluationStatus: 'completed',
        evaluationProgress: 100,
        evaluationMessage: '评估完成',
        bandScore: avgOverall,
        evaluatedAt: new Date()
      }
    });

    console.log('[BackgroundEval] Evaluation completed for session:', sessionId, 'Band score:', avgOverall);
  } else {
    await db.testSession.update({
      where: { id: sessionId },
      data: {
        evaluationStatus: 'failed',
        evaluationMessage: '评估失败，请重试'
      }
    });
  }
}
