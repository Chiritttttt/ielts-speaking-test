import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// 版本信息 - 在首次加载时确定
let buildTime: string | null = null;

function getBuildTime(): string {
  if (buildTime) return buildTime;
  
  try {
    // 尝试读取构建时间戳文件（由 npm run build 后生成）
    const buildInfoPath = join(process.cwd(), '.next', 'BUILD_ID');
    if (existsSync(buildInfoPath)) {
      const buildId = readFileSync(buildInfoPath, 'utf-8').trim();
      buildTime = buildId;
      return buildTime;
    }
  } catch (e) {
    console.warn('[Version] Could not read BUILD_ID:', e);
  }
  
  // 备用：使用启动时间（同一运行期间保持不变）
  buildTime = `startup-${Date.now()}`;
  return buildTime;
}

export async function GET() {
  return NextResponse.json({
    version: process.env.npm_package_version || '1.0.0',
    buildTime: getBuildTime(),
  });
}
