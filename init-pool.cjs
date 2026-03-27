const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 检查是否已有题库
  const existingPools = await prisma.questionPool.findMany();
  if (existingPools.length > 0) {
    console.log('已有题库:', existingPools.map(p => p.name).join(', '));
    return;
  }

  // 创建默认题库
  const defaultPool = await prisma.questionPool.create({
    data: {
      name: '默认题库',
      description: '系统默认题库，包含所有导入和生成的题目',
      type: 'general',
      isActive: true,
      isDefault: true,
      source: 'system'
    }
  });

  console.log('✅ 已创建默认题库:', defaultPool.name);
  console.log('');
  console.log('现在您可以在管理后台:');
  console.log('1. 导入题目到此题库');
  console.log('2. AI 生成新题目');
  console.log('3. 创建新的考试季题库');
}

main().catch(console.error).finally(() => prisma.$disconnect());
