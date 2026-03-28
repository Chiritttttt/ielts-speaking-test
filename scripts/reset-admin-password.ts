/**
 * 重置管理员密码脚本
 * 使用方法: npx ts-node scripts/reset-admin-password.ts <用户名> <新密码>
 */

import * as crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 密码哈希函数（与 auth.ts 中一致）
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('使用方法: npx ts-node scripts/reset-admin-password.ts <用户名> <新密码>');
    console.log('示例: npx ts-node scripts/reset-admin-password.ts admin newpassword123');
    process.exit(1);
  }

  const username = args[0];
  const newPassword = args[1];

  if (newPassword.length < 6) {
    console.log('错误: 密码至少需要6个字符');
    process.exit(1);
  }

  // 查找管理员
  const admin = await prisma.user.findFirst({
    where: {
      username,
      role: 'admin'
    }
  });

  if (!admin) {
    console.log(`错误: 找不到用户名为 "${username}" 的管理员`);
    process.exit(1);
  }

  // 哈希新密码
  const hashedPassword = await hashPassword(newPassword);

  // 更新密码
  await prisma.user.update({
    where: { id: admin.id },
    data: { password: hashedPassword }
  });

  console.log('✅ 管理员密码已更新！');
  console.log(`   用户名: ${username}`);
  console.log(`   新密码: ${newPassword}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
