import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, generateToken, setAuthCookie } from '@/lib/auth';

// 获取客户端 IP
function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return 'unknown';
}

// 获取 User-Agent
function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

// 记录登录日志
async function recordLoginLog(
  userId: string | null,
  username: string,
  success: boolean,
  failReason: string | null,
  ipAddress: string,
  userAgent: string
) {
  try {
    await db.loginLog.create({
      data: {
        userId,
        username,
        success,
        failReason,
        ipAddress,
        userAgent
      }
    });
  } catch (error) {
    console.error('Record login log error:', error);
  }
}

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request);
  const userAgent = getUserAgent(request);

  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      await recordLoginLog(null, username || 'unknown', false, '缺少用户名或密码', ipAddress, userAgent);
      return NextResponse.json({
        success: false,
        error: '请输入用户名和密码'
      }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { username }
    });

    if (!user) {
      await recordLoginLog(null, username, false, '用户不存在', ipAddress, userAgent);
      return NextResponse.json({
        success: false,
        error: '用户名或密码错误'
      }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      await recordLoginLog(user.id, username, false, '密码错误', ipAddress, userAgent);
      return NextResponse.json({
        success: false,
        error: '用户名或密码错误'
      }, { status: 401 });
    }

    // 检查用户状态
    if (user.status === 'pending') {
      await recordLoginLog(user.id, username, false, '账号待审批', ipAddress, userAgent);
      return NextResponse.json({
        success: false,
        error: '账号正在等待管理员审批，请耐心等待',
        status: 'pending'
      }, { status: 403 });
    }

    if (user.status === 'rejected') {
      await recordLoginLog(user.id, username, false, '账号被拒绝', ipAddress, userAgent);
      return NextResponse.json({
        success: false,
        error: '您的注册申请已被拒绝',
        status: 'rejected'
      }, { status: 403 });
    }

    if (user.status === 'suspended') {
      await recordLoginLog(user.id, username, false, '账号被停用', ipAddress, userAgent);
      return NextResponse.json({
        success: false,
        error: '账号已被停用，请联系管理员',
        status: 'suspended'
      }, { status: 403 });
    }

    // 登录成功，记录日志
    await recordLoginLog(user.id, username, true, null, ipAddress, userAgent);

    const token = generateToken(user.id);
    const response = NextResponse.json({
      success: true,
      isAdmin: user.role === 'admin',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        level: user.level,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
        activatedAt: user.activatedAt?.toISOString(),
        expiresAt: user.expiresAt?.toISOString()
      }
    });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    await recordLoginLog(null, 'unknown', false, '系统错误', ipAddress, userAgent);
    return NextResponse.json({
      success: false,
      error: '登录失败，请稍后重试'
    }, { status: 500 });
  }
}
