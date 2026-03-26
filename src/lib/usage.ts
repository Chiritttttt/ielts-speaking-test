import { db } from './db';

// 获取北京时间日期字符串
function getBeijingDate(): string {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return beijingTime.toISOString().split('T')[0];
}

// API 类型
export type ApiType = 'deepseek' | 'whisper' | 'tts';
export type ApiAction = 'evaluate' | 'translate' | 'generate' | 'transcribe' | 'daily_expr' | 'grammar_fix' | 'synthesize';

/**
 * 记录 API 调用
 */
export async function recordApiUsage(
  type: ApiType,
  action: ApiAction,
  options: {
    userId?: string;
    success?: boolean;
    tokens?: number;
    duration?: number;
  } = {}
): Promise<void> {
  try {
    await db.apiUsage.create({
      data: {
        type,
        action,
        userId: options.userId,
        success: options.success ?? true,
        tokens: options.tokens ?? 0,
        duration: options.duration ?? 0,
        date: getBeijingDate(),
      },
    });
  } catch (error) {
    console.error('[Usage] Record error:', error);
  }
}

/**
 * 获取用量统计
 */
export async function getUsageStats(days: number = 7) {
  const today = getBeijingDate();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  const startDateStr = startDate.toISOString().split('T')[0];

  // 按日期和类型统计
  const records = await db.apiUsage.findMany({
    where: {
      date: { gte: startDateStr },
    },
  });

  // 汇总统计
  const stats = {
    deepseek: { count: 0, tokens: 0 },
    whisper: { count: 0 },
    tts: { count: 0 },
    byAction: {} as Record<string, number>,
    byDate: {} as Record<string, { deepseek: number; whisper: number; tts: number }>,
    totalCalls: 0,
  };

  for (const r of records) {
    stats.totalCalls++;
    
    if (r.type === 'deepseek') {
      stats.deepseek.count++;
      stats.deepseek.tokens += r.tokens;
    } else if (r.type === 'whisper') {
      stats.whisper.count++;
    } else if (r.type === 'tts') {
      stats.tts.count++;
    }

    // 按动作统计
    stats.byAction[r.action] = (stats.byAction[r.action] || 0) + 1;

    // 按日期统计
    if (!stats.byDate[r.date]) {
      stats.byDate[r.date] = { deepseek: 0, whisper: 0, tts: 0 };
    }
    if (r.type === 'deepseek') stats.byDate[r.date].deepseek++;
    else if (r.type === 'whisper') stats.byDate[r.date].whisper++;
    else if (r.type === 'tts') stats.byDate[r.date].tts++;
  }

  return stats;
}

/**
 * 获取平台总体统计
 */
export async function getPlatformStats() {
  const [userCount, activeUsers, sessionCount, todaySessions, questionCount] = await Promise.all([
    // 总用户数
    db.user.count(),
    // 已批准用户数
    db.user.count({ where: { status: 'approved' } }),
    // 总测试会话数
    db.testSession.count(),
    // 今日测试数
    db.testSession.count({
      where: {
        startedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    // 题库题目数
    db.questionBank.count(),
  ]);

  return {
    userCount,
    activeUsers,
    sessionCount,
    todaySessions,
    questionCount,
  };
}
