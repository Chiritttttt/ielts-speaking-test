import { NextResponse } from 'next/server';

// 版本号在构建时生成
// 使用环境变量或构建时间
const VERSION = process.env.npm_package_version || '1.0.0';
const BUILD_TIME = new Date().toISOString();

export async function GET() {
  return NextResponse.json({
    version: VERSION,
    buildTime: BUILD_TIME,
    // 使用 git commit hash 作为版本标识（如果可用）
    commit: process.env.VERCEL_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || 'local'
  });
}
