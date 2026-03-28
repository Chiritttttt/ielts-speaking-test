/**
 * 修复数据库中的非标准雅思分数
 * 将所有分数转换为 0.5 递增的标准格式（如 6.0, 6.5, 7.0）
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 雅思标准分数处理：0.5 递增
function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

async function fixBandScores() {
  console.log('开始修复雅思分数...\n');

  try {
    // 1. 修复 SpeakingResponse 表中的分数
    console.log('=== 修复 SpeakingResponse 表 ===');
    const responses = await prisma.speakingResponse.findMany({
      where: {
        OR: [
          { fluencyScore: { not: { in: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9] } } },
          { vocabularyScore: { not: { in: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9] } } },
          { grammarScore: { not: { in: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9] } } },
          { pronunciationScore: { not: { in: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9] } } },
          { overallScore: { not: { in: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9] } } },
        ]
      }
    });

    console.log(`找到 ${responses.length} 条需要修复的响应记录`);

    let fixedCount = 0;
    for (const response of responses) {
      const newFluency = roundToHalf(response.fluencyScore ?? 6.0);
      const newVocabulary = roundToHalf(response.vocabularyScore ?? 6.0);
      const newGrammar = roundToHalf(response.grammarScore ?? 6.0);
      const newPronunciation = roundToHalf(response.pronunciationScore ?? 6.0);
      const newOverall = roundToHalf(response.overallScore ?? 6.0);

      // 只有当分数真正需要改变时才更新
      if (
        newFluency !== response.fluencyScore ||
        newVocabulary !== response.vocabularyScore ||
        newGrammar !== response.grammarScore ||
        newPronunciation !== response.pronunciationScore ||
        newOverall !== response.overallScore
      ) {
        await prisma.speakingResponse.update({
          where: { id: response.id },
          data: {
            fluencyScore: newFluency,
            vocabularyScore: newVocabulary,
            grammarScore: newGrammar,
            pronunciationScore: newPronunciation,
            overallScore: newOverall,
          }
        });
        fixedCount++;
        console.log(`  修复响应 ${response.id}: ${response.overallScore} → ${newOverall}`);
      }
    }
    console.log(`修复了 ${fixedCount} 条响应记录\n`);

    // 2. 修复 TestSession 表中的分数
    console.log('=== 修复 TestSession 表 ===');
    const sessions = await prisma.testSession.findMany({
      where: {
        bandScore: { not: null }
      }
    });

    let sessionFixedCount = 0;
    for (const session of sessions) {
      if (session.bandScore) {
        const newBandScore = roundToHalf(session.bandScore);
        if (newBandScore !== session.bandScore) {
          await prisma.testSession.update({
            where: { id: session.id },
            data: { bandScore: newBandScore }
          });
          sessionFixedCount++;
          console.log(`  修复会话 ${session.id}: ${session.bandScore} → ${newBandScore}`);
        }
      }
    }
    console.log(`修复了 ${sessionFixedCount} 条会话记录\n`);

    console.log('=== 修复完成 ===');
    console.log(`总计修复: ${fixedCount} 条响应记录, ${sessionFixedCount} 条会话记录`);

  } catch (error) {
    console.error('修复过程中出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBandScores();
