import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, name } = body;

    if (!username || !password) {
      return NextResponse.json({
        success: false,
        error: '用户名和密码不能为空'
      }, { status: 400 });
    }

    if (username.length < 3) {
      return NextResponse.json({
        success: false,
        error: '用户名至少需要3个字符'
      }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({
        success: false,
        error: '密码至少需要6个字符'
      }, { status: 400 });
    }

    const existingUser = await db.user.findUnique({
      where: { username }
    });

    if (existingUser) {
      return NextResponse.json({
        success: false,
        error: '用户名已被使用'
      }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    const user = await db.user.create({
      data: {
        username,
        password: hashedPassword,
        name: name || username,
        level: 'intermediate'
      }
    });

    await db.userSettings.create({
      data: {
        userId: user.id,
        defaultVoice: 'us-female',
        voiceSpeed: 1.0,
        showQuestionAfterSpeech: false,
        autoPlayQuestion: true
      }
    });

    const token = generateToken(user.id);
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        level: user.level,
        createdAt: user.createdAt.toISOString()
      }
    });
    
    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json({
      success: false,
      error: '注册失败，请稍后重试'
    }, { status: 500 });
  }
}
