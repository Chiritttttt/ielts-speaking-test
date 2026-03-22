import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callDeepSeek, IELTS_EVALUATION_PROMPT } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, partNumber, transcriptions } = body;

    console.log('[Evaluate] Starting evaluation:', { 
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

    const results = [];
    let totalFluency = 0;
    let totalVocabulary = 0;
    let totalGrammar = 0;
    let totalPronunciation = 0;
    let totalOverall = 0;

    for (let i = 0; i < transcriptions.length; i++) {
      const transcription = transcriptions[i];
      console.log(`[Evaluate] Processing transcription ${i + 1}/${transcriptions.length}`);
      
      const prompt = `${IELTS_EVALUATION_PROMPT}

## Question (Part ${transcription.partNumber}):
${transcription.questionText}

## Candidate's Response:
"${transcription.transcription}"

## Response Duration: ${transcription.duration} seconds

Please evaluate this IELTS Speaking response. Output only valid JSON without markdown code blocks.`;

      const result = await callDeepSeek([
        { role: 'user', content: prompt }
      ], { temperature: 0.3, max_tokens: 2000 });

      if (!result.success) {
        console.error('[Evaluate] API call failed:', result.error);
        continue;
      }

      if (result.content) {
        try {
          // 清理 JSON 字符串
          let jsonStr = result.content
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .trim();
          
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonStr = jsonMatch[0];
          }
          
          const evaluation = JSON.parse(jsonStr);
          console.log('[Evaluate] Parsed evaluation scores:', evaluation.scores);

          const scores = {
            fluencyCoherence: Number(evaluation.scores?.fluencyCoherence) || 6.0,
            lexicalResource: Number(evaluation.scores?.lexicalResource) || 6.0,
            grammaticalRange: Number(evaluation.scores?.grammaticalRange) || 6.0,
            pronunciation: Number(evaluation.scores?.pronunciation) || 6.0,
            overall: 0
          };
          
          // 确保分数在有效范围内
          scores.fluencyCoherence = Math.min(9, Math.max(0, scores.fluencyCoherence));
          scores.lexicalResource = Math.min(9, Math.max(0, scores.lexicalResource));
          scores.grammaticalRange = Math.min(9, Math.max(0, scores.grammaticalRange));
          scores.pronunciation = Math.min(9, Math.max(0, scores.pronunciation));
          scores.overall = (scores.fluencyCoherence + scores.lexicalResource + scores.grammaticalRange + scores.pronunciation) / 4;

          totalFluency += scores.fluencyCoherence;
          totalVocabulary += scores.lexicalResource;
          totalGrammar += scores.grammaticalRange;
          totalPronunciation += scores.pronunciation;
          totalOverall += scores.overall;

          // 保存到数据库
          try {
            const responseRecord = await db.speakingResponse.create({
              data: {
                sessionId: sessionId || 'unknown',
                partNumber: transcription.partNumber,
                questionText: transcription.questionText,
                transcription: transcription.transcription,
                duration: transcription.duration,
                audioBase64: transcription.audioBase64,
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

            results.push({
              id: responseRecord.id,
              partNumber: transcription.partNumber,
              questionText: transcription.questionText,
              transcription: transcription.transcription,
              duration: transcription.duration,
              scores,
              feedback: evaluation.feedback || {},
              improvements: evaluation.improvements || [],
              strengths: evaluation.strengths || [],
              modelAnswer: evaluation.modelAnswer || ''
            });
          } catch (dbError) {
            console.error('[Evaluate] Database error:', dbError);
            // 即使数据库保存失败，也返回结果
            results.push({
              partNumber: transcription.partNumber,
              questionText: transcription.questionText,
              transcription: transcription.transcription,
              duration: transcription.duration,
              scores,
              feedback: evaluation.feedback || {},
              improvements: evaluation.improvements || [],
              strengths: evaluation.strengths || [],
              modelAnswer: evaluation.modelAnswer || ''
            });
          }
        } catch (parseError) {
          console.error('[Evaluate] JSON parse error:', parseError);
          console.error('[Evaluate] Raw content:', result.content?.substring(0, 500));
        }
      }
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: false,
        error: '评估失败，请检查 API 配置或网络连接'
      }, { status: 500 });
    }

    const count = results.length;
    const averageScores = {
      fluencyCoherence: totalFluency / count,
      lexicalResource: totalVocabulary / count,
      grammaticalRange: totalGrammar / count,
      pronunciation: totalPronunciation / count,
      overall: totalOverall / count
    };

    const partBandScore = (
      averageScores.fluencyCoherence +
      averageScores.lexicalResource +
      averageScores.grammaticalRange +
      averageScores.pronunciation
    ) / 4;

    console.log('[Evaluate] Evaluation complete:', { 
      resultCount: results.length, 
      averageScores, 
      partBandScore 
    });

    // Update session if this is final evaluation
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
