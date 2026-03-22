import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, getAuthToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testType, userId } = body;

    const currentUserId = userId || `guest_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const session = await db.testSession.create({
      data: {
        userId: currentUserId.startsWith('guest') ? null : currentUserId,
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
