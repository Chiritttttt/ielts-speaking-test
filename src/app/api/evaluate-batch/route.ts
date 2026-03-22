import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callDeepSeek, IELTS_EVALUATION_PROMPT } from '@/lib/deepseek';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, partNumber, transcriptions } = body;

    if (!transcriptions || transcriptions.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No transcriptions to evaluate'
      }, { status: 400 });
    }

    const results = [];
    let totalFluency = 0;
    let totalVocabulary = 0;
    let totalGrammar = 0;
    let totalPronunciation = 0;
    let totalOverall = 0;

    for (const transcription of transcriptions) {
      const prompt = `${IELTS_EVALUATION_PROMPT}

## Question (Part ${transcription.partNumber}):
${transcription.questionText}

## Candidate's Response:
"${transcription.transcription}"

## Response Duration: ${transcription.duration} seconds

Evaluate this IELTS Speaking response. Output only valid JSON.`;

      const result = await callDeepSeek([
        { role: 'user', content: prompt }
      ], { temperature: 0.3 });

      if (result.success && result.content) {
        try {
          let jsonStr = result.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            jsonStr = jsonMatch[0];
          }
          const evaluation = JSON.parse(jsonStr);

          const scores = {
            fluencyCoherence: evaluation.scores?.fluencyCoherence || 6.0,
            lexicalResource: evaluation.scores?.lexicalResource || 6.0,
            grammaticalRange: evaluation.scores?.grammaticalRange || 6.0,
            pronunciation: evaluation.scores?.pronunciation || 6.0,
            overall: (
              (evaluation.scores?.fluencyCoherence || 6.0) +
              (evaluation.scores?.lexicalResource || 6.0) +
              (evaluation.scores?.grammaticalRange || 6.0) +
              (evaluation.scores?.pronunciation || 6.0)
            ) / 4
          };

          totalFluency += scores.fluencyCoherence;
          totalVocabulary += scores.lexicalResource;
          totalGrammar += scores.grammaticalRange;
          totalPronunciation += scores.pronunciation;
          totalOverall += scores.overall;

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
              modelAnswer: evaluation.modelAnswer
            }
          });

          results.push({
            id: responseRecord.id,
            partNumber: transcription.partNumber,
            questionText: transcription.questionText,
            transcription: transcription.transcription,
            duration: transcription.duration,
            scores,
            feedback: evaluation.feedback,
            improvements: evaluation.improvements,
            modelAnswer: evaluation.modelAnswer
          });
        } catch (parseError) {
          console.error('Parse error:', parseError);
          // Use default scores if parsing fails
          const defaultScores = {
            fluencyCoherence: 6.0,
            lexicalResource: 6.0,
            grammaticalRange: 6.0,
            pronunciation: 6.0,
            overall: 6.0
          };
          totalFluency += defaultScores.fluencyCoherence;
          totalVocabulary += defaultScores.lexicalResource;
          totalGrammar += defaultScores.grammaticalRange;
          totalPronunciation += defaultScores.pronunciation;
          totalOverall += defaultScores.overall;
        }
      }
    }

    const count = results.length || 1;
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

    // Update session if this is final evaluation
    if (sessionId && partNumber === 0) {
      await db.testSession.update({
        where: { id: sessionId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          bandScore: partBandScore
        }
      });
    }

    return NextResponse.json({
      success: true,
      responses: results,
      averageScores,
      partBandScore
    });
  } catch (error) {
    console.error('Evaluate batch error:', error);
    return NextResponse.json({
      success: false,
      error: '评估失败'
    }, { status: 500 });
  }
}
