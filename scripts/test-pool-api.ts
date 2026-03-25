import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Testing database connection...');

  // 检查现有题库
  const existingPools = await prisma.questionPool.findMany();
  console.log('Existing pools:', existingPools.length);

  // 尝试创建新题库
  try {
    const newPool = await prisma.questionPool.create({
      data: {
        name: '测试题库 ' + new Date().toISOString(),
        description: '这是一个测试题库',
        isActive: true,
        isDefault: false,
        source: 'ai'
      }
    });
    console.log('Created pool:', newPool);

    // 删除测试题库
    await prisma.questionPool.delete({
      where: { id: newPool.id }
    });
    console.log('Deleted test pool');
  } catch (error) {
    console.error('Error creating pool:', error);
  }
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
