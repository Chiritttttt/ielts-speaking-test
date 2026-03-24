import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, getAuthToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testType, userId } = body;

    // 确定 userId：如果是 guest 用户或用户不存在，则设为 null
    let sessionUserId: string | null = null;
    
    if (userId && !userId.startsWith('guest')) {
      // 检查用户是否存在
      const user = await db.user.findUnique({
        where: { id: userId }
      });
      if (user) {
        sessionUserId = userId;
      }
    }
    
    const session = await db.testSession.create({
      data: {
        userId: sessionUserId,
        testType: testType || 'full',
        status: 'in_progress'
      }
    });

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        testType: session.testType,
        status: session.status,
        startedAt: session.startedAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json({
      success: false,
      error: '创建会话失败'
    }, { status: 500 });
  }
}
