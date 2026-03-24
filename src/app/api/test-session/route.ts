import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// 最大访客测试次数
const MAX_GUEST_SESSIONS = 1;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { testType } = body;

    // 检查是否是已登录用户
    const currentUser = await getCurrentUser(request);
    
    if (currentUser) {
      // 已登录用户 - 检查是否已获批准
      if (currentUser.role !== 'admin' && currentUser.status !== 'approved') {
        return NextResponse.json({
          success: false,
          error: currentUser.status === 'pending' 
            ? '账号正在等待审批，请耐心等待管理员审核' 
            : '账号已被禁用，请联系管理员',
          status: currentUser.status,
          needApproval: true
        }, { status: 403 });
      }
      
      // 已批准用户 - 正常创建会话
      const session = await db.testSession.create({
        data: {
          userId: currentUser.id,
          testType: testType || 'full',
          status: 'in_progress',
          evaluationStatus: 'pending'
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
    }

    // 访客用户 - 检查是否已测试过
    const guestSessionsCount = await db.testSession.count({
      where: {
        userId: null
      }
    });

    if (guestSessionsCount >= MAX_GUEST_SESSIONS) {
      return NextResponse.json({
        success: false,
        error: '访客试用次数已用完，请注册账号后继续使用',
        needRegister: true,
        guestLimitReached: true
      }, { status: 403 });
    }

    // 创建访客会话
    const session = await db.testSession.create({
      data: {
        userId: null,
        testType: testType || 'full',
        status: 'in_progress',
        evaluationStatus: 'pending'
      }
    });

    return NextResponse.json({
      success: true,
      isGuest: true,
      remainingGuestSessions: MAX_GUEST_SESSIONS - guestSessionsCount - 1,
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
