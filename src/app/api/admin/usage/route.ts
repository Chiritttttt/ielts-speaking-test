import { NextRequest, NextResponse } from 'next/server';
import { getUsageStats, getPlatformStats, recordApiUsage, ApiType, ApiAction } from '@/lib/usage';
import { getCurrentUser } from '@/lib/auth';

/**
 * 获取用量统计
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ success: false, error: '无权限' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');

    const [usageStats, platformStats] = await Promise.all([
      getUsageStats(days),
      getPlatformStats(),
    ]);

    return NextResponse.json({
      success: true,
      usage: usageStats,
      platform: platformStats,
    });
  } catch (error) {
    console.error('[Usage API] Error:', error);
    return NextResponse.json({
      success: false,
      error: '获取统计失败',
    }, { status: 500 });
  }
}

/**
 * 记录 API 调用（供其他 API 内部调用）
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, action, userId, success, tokens, duration } = body;

    await recordApiUsage(
      type as ApiType,
      action as ApiAction,
      { userId, success, tokens, duration }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Usage API] Record error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
