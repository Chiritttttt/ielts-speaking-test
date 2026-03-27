/**
 * 数据迁移脚本：将现有题目关联到默认题库
 * 
 * 运行方式：node migrate-to-pool.cjs
 * 
 * 功能：
 * 1. 创建默认题库（如果不存在）
 * 2. 将所有没有 poolId 的题目关联到默认题库
 * 3. 更新题库的题目统计
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('========================================');
  console.log('  题库迁移脚本');
  console.log('========================================\n');

  // 1. 检查或创建默认题库
  console.log('步骤 1: 检查默认题库...');
  let defaultPool = await prisma.questionPool.findFirst({
    where: { isDefault: true }
  });

  if (!defaultPool) {
    console.log('  未找到默认题库，正在创建...');
    defaultPool = await prisma.questionPool.create({
      data: {
        name: '默认题库',
        description: '系统默认题库，包含所有导入和生成的题目',
        type: 'general',
        isActive: true,
        isDefault: true,
        source: 'system'
      }
    });
    console.log('  ✅ 已创建默认题库:', defaultPool.name);
  } else {
    console.log('  ✅ 已存在默认题库:', defaultPool.name);
  }

  const poolId = defaultPool.id;

  // 2. 统计需要迁移的题目
  console.log('\n步骤 2: 统计需要迁移的题目...');
  const totalQuestions = await prisma.questionBank.count();
  const questionsWithoutPool = await prisma.questionBank.count({
    where: { poolId: null }
  });
  
  console.log(`  总题目数: ${totalQuestions}`);
  console.log(`  无题库的题目: ${questionsWithoutPool}`);

  if (questionsWithoutPool === 0) {
    console.log('\n  ✅ 所有题目已关联题库，无需迁移');
    return;
  }

  // 3. 迁移题目
  console.log('\n步骤 3: 迁移题目到默认题库...');
  const result = await prisma.questionBank.updateMany({
    where: { poolId: null },
    data: { poolId: poolId }
  });
  console.log(`  ✅ 已迁移 ${result.count} 道题目`);

  // 4. 更新题库统计
  console.log('\n步骤 4: 更新题库统计...');
  const part1Count = await prisma.questionBank.count({
    where: { poolId: poolId, partNumber: 1 }
  });
  const part2Count = await prisma.questionBank.count({
    where: { poolId: poolId, partNumber: 2 }
  });
  const part3Count = await prisma.questionBank.count({
    where: { poolId: poolId, partNumber: 3 }
  });

  await prisma.questionPool.update({
    where: { id: poolId },
    data: {
      part1Count,
      part2Count,
      part3Count
    }
  });

  console.log(`  Part 1: ${part1Count} 题`);
  console.log(`  Part 2: ${part2Count} 题`);
  console.log(`  Part 3: ${part3Count} 题`);
  console.log(`  总计: ${part1Count + part2Count + part3Count} 题`);

  console.log('\n========================================');
  console.log('  ✅ 迁移完成！');
  console.log('========================================');
}

main()
  .catch((e) => {
    console.error('❌ 迁移失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
