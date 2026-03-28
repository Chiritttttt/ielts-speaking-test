/**
 * 修复数据库中的非标准雅思分数
 * 将所有分数转换为 0.5 递增的标准格式（如 6.0, 6.5, 7.0）
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 雅思标准分数处理：0.5 递增
function roundToHalf(n) {
  return Math.round(n * 2) / 2;
}

// 标准雅思分数列表
const validScores = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];

async function fixBandScores() {
  console.log('开始修复雅思分数...\n');

  try {
    // 1. 修复 SpeakingResponse 表中的分数
    console.log('=== 修复 SpeakingResponse 表 ===');
    const responses = await prisma.speakingResponse.findMany();

    console.log(`共 ${responses.length} 条响应记录`);

    let fixedCount = 0;
    for (const response of responses) {
      const oldFluency = response.fluencyScore ?? 6.0;
      const oldVocabulary = response.vocabularyScore ?? 6.0;
      const oldGrammar = response.grammarScore ?? 6.0;
      const oldPronunciation = response.pronunciationScore ?? 6.0;
      const oldOverall = response.overallScore ?? 6.0;

      const newFluency = roundToHalf(oldFluency);
      const newVocabulary = roundToHalf(oldVocabulary);
      const newGrammar = roundToHalf(oldGrammar);
      const newPronunciation = roundToHalf(oldPronunciation);
      const newOverall = roundToHalf(oldOverall);

      // 只有当分数真正需要改变时才更新
      if (
        newFluency !== oldFluency ||
        newVocabulary !== oldVocabulary ||
        newGrammar !== oldGrammar ||
        newPronunciation !== oldPronunciation ||
        newOverall !== oldOverall
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
        console.log(`  修复响应 ${response.id}: FC=${oldFluency}→${newFluency}, LR=${oldVocabulary}→${newVocabulary}, GRA=${oldGrammar}→${newGrammar}, P=${oldPronunciation}→${newPronunciation}, Overall=${oldOverall}→${newOverall}`);
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

    console.log(`共 ${sessions.length} 条有分数的会话记录`);

    let sessionFixedCount = 0;
    for (const session of sessions) {
      if (session.bandScore !== null) {
        const oldBandScore = session.bandScore;
        const newBandScore = roundToHalf(oldBandScore);
        if (newBandScore !== oldBandScore) {
          await prisma.testSession.update({
            where: { id: session.id },
            data: { bandScore: newBandScore }
          });
          sessionFixedCount++;
          console.log(`  修复会话 ${session.id}: ${oldBandScore} → ${newBandScore}`);
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
