const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 查看数据库中的所有表
  const tables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`;
  console.log('=== 数据库表 ===');
  tables.forEach(t => console.log(`  - ${t.name}`));
  
  // 检查 QuestionPool 表
  try {
    const poolColumns = await prisma.$queryRaw`PRAGMA table_info(QuestionPool)`;
    console.log('\n=== QuestionPool 表结构 ===');
    poolColumns.forEach(col => {
      console.log(`  ${col.name}: ${col.type}`);
    });
  } catch (e) {
    console.log('QuestionPool 表不存在');
  }
  
  // 检查 QuestionBank 表是否有 poolId
  try {
    const qbColumns = await prisma.$queryRaw`PRAGMA table_info(QuestionBank)`;
    const hasPoolId = qbColumns.some(col => col.name === 'poolId');
    console.log('\n=== QuestionBank 表 ===');
    console.log('  有 poolId 列:', hasPoolId ? '是' : '否');
  } catch (e) {
    console.log('检查 QuestionBank 失败:', e);
  }
  
  // 查看题库列表
  const pools = await prisma.questionPool.findMany();
  console.log('\n=== 题库列表 ===');
  if (pools.length === 0) {
    console.log('  (无题库)');
  } else {
    pools.forEach(p => {
      console.log(`  - ${p.name} (${p.type}) 默认:${p.isDefault} 启用:${p.isActive}`);
    });
  }
  
  // 查看题目统计
  const questionCount = await prisma.questionBank.count();
  console.log('\n=== 题目统计 ===');
  console.log(`  总数: ${questionCount}`);
  
  if (questionCount > 0) {
    const byPart = await prisma.questionBank.groupBy({
      by: ['partNumber'],
      _count: true
    });
    byPart.forEach(row => {
      console.log(`  Part ${row.partNumber}: ${row._count} 题`);
    });
    
    // 查看没有 poolId 的题目
    const orphanCount = await prisma.questionBank.count({
      where: { poolId: null }
    });
    console.log(`  无题库的题目: ${orphanCount}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
