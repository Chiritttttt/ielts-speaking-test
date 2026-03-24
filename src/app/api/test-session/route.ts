import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { randomUUID } from 'crypto';

// 最大访客测试次数
const MAX_GUEST_SESSIONS = 1;
const GUEST_COOKIE_NAME = 'guest_id';

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

    // 访客用户 - 使用 cookie 追踪
    let guestId = request.cookies.get(GUEST_COOKIE_NAME)?.value;

    // 如果没有 guest_id cookie，创建一个新的
    if (!guestId) {
      guestId = randomUUID();
    }

    // 查询或创建访客使用记录
    let guestUsage = await db.guestUsage.findUnique({
      where: { guestId }
    });

    if (!guestUsage) {
      // 创建新的访客记录
      guestUsage = await db.guestUsage.create({
        data: {
          guestId,
          usedCount: 0
        }
      });
    }

    // 检查访客使用次数
    if (guestUsage.usedCount >= MAX_GUEST_SESSIONS) {
      const response = NextResponse.json({
        success: false,
        error: '访客试用次数已用完，请注册账号后继续使用',
        needRegister: true,
        guestLimitReached: true
      }, { status: 403 });

      // 确保设置 cookie
      response.cookies.set(GUEST_COOKIE_NAME, guestId, {
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60,
        path: '/'
      });

      return response;
    }

    // 创建访客会话
    const session = await db.testSession.create({
      data: {
        userId: null,
        guestId: guestId,
        testType: testType || 'full',
        status: 'in_progress',
        evaluationStatus: 'pending'
      }
    });

    // 增加访客使用次数（独立计数，删除历史记录不影响）
    await db.guestUsage.update({
      where: { guestId },
      data: { usedCount: { increment: 1 } }
    });

    const response = NextResponse.json({
      success: true,
      isGuest: true,
      remainingGuestSessions: MAX_GUEST_SESSIONS - guestUsage.usedCount - 1,
      session: {
        id: session.id,
        testType: session.testType,
        status: session.status,
        startedAt: session.startedAt.toISOString()
      }
    });

    // 设置访客 cookie
    response.cookies.set(GUEST_COOKIE_NAME, guestId, {
      httpOnly: true,
      maxAge: 365 * 24 * 60 * 60,
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json({
      success: false,
      error: '创建会话失败'
    }, { status: 500 });
  }
}
