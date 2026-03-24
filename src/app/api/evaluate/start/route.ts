import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

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

    // 保存待评估的转录到临时存储（使用 SpeakingResponse 表，标记为待评估）
    // 先删除该会话的旧评估数据
    await db.speakingResponse.deleteMany({
      where: { sessionId }
    });

    // 保存转录数据（作为待评估状态）
    for (const t of transcriptions) {
      await db.speakingResponse.create({
        data: {
          sessionId,
          partNumber: t.partNumber || 1,
          questionText: t.questionText,
          transcription: t.transcription,
          duration: t.duration,
          audioPath: t.audioId || null,
          // 分数先设为 null，表示待评估
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

    // 启动后台评估（fire and forget）
    // 在 Next.js 中，我们使用一个技巧：发起一个内部请求但不等待
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    // 使用 Promise 但不等待 - 这会在后台继续执行
    runBackgroundEvaluation(sessionId, transcriptions, baseUrl).catch(error => {
      console.error('[EvaluateStart] Background evaluation failed:', error);
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

// 后台评估函数
async function runBackgroundEvaluation(sessionId: string, transcriptions: any[], baseUrl: string) {
  const { callDeepSeek, getEvaluationPrompt } = await import('@/lib/deepseek');
  
  console.log('[BackgroundEval] Starting background evaluation for session:', sessionId);
  
  const total = transcriptions.length;
  let successCount = 0;
  let totalScores = { fluency: 0, vocabulary: 0, grammar: 0, pronunciation: 0, overall: 0 };

  for (let i = 0; i < transcriptions.length; i++) {
    const t = transcriptions[i];
    const partNumber = t.partNumber || 1;
    const progress = Math.round(((i + 1) / total) * 100);

    // 更新进度
    try {
      await db.testSession.update({
        where: { id: sessionId },
        data: {
          evaluationProgress: progress,
          evaluationMessage: `正在评估第 ${i + 1}/${total} 个回答...`
        }
      });
    } catch (e) {
      console.error('[BackgroundEval] Failed to update progress:', e);
    }

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
      ], { temperature: 0.3, max_tokens: 2500 });

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

        totalScores.fluency += scores.fluencyCoherence;
        totalScores.vocabulary += scores.lexicalResource;
        totalScores.grammar += scores.grammaticalRange;
        totalScores.pronunciation += scores.pronunciation;
        totalScores.overall += scores.overall;

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

        successCount++;
        console.log(`[BackgroundEval] Evaluated ${i + 1}/${total} successfully`);
      }
    } catch (error) {
      console.error(`[BackgroundEval] Error evaluating response ${i + 1}:`, error);
    }

    // 添加延迟，避免 API 限流
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (successCount > 0) {
    // 计算平均分
    const avgOverall = totalScores.overall / successCount;

    // 更新会话状态为评估完成
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
    // 评估失败
    await db.testSession.update({
      where: { id: sessionId },
      data: {
        evaluationStatus: 'failed',
        evaluationMessage: '评估失败，请重试'
      }
    });
  }
}
