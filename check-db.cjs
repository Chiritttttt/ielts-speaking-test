const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== 题库列表 ===');
  const pools = await prisma.questionPool.findMany({ 
    select: { id: true, name: true, type: true, isActive: true, isDefault: true }
  });
  console.log(JSON.stringify(pools, null, 2));
  
  console.log('\n=== 题目统计 ===');
  const questionCount = await prisma.questionBank.count();
  console.log('总题目数:', questionCount);
  
  const byPart = await prisma.questionBank.groupBy({
    by: ['partNumber'],
    _count: true
  });
  console.log('按Part分组:', JSON.stringify(byPart, null, 2));
  
  // 查看没有 poolId 的题目
  const orphanQuestions = await prisma.questionBank.count({
    where: { poolId: null }
  });
  console.log('无题库的题目数:', orphanQuestions);
}

main().catch(console.error).finally(() => prisma.$disconnect());
