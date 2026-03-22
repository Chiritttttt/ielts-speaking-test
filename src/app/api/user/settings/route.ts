import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, getAuthToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    
    if (!token) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 });
    }

    let settings = await db.userSettings.findUnique({
      where: { userId }
    });

    if (!settings) {
      settings = await db.userSettings.create({
        data: {
          userId,
          defaultVoice: 'us-female',
          voiceSpeed: 1.0,
          showQuestionAfterSpeech: false,
          autoPlayQuestion: true
        }
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        defaultVoice: settings.defaultVoice || 'us-female',
        voiceSpeed: settings.voiceSpeed ?? 1.0,
        showQuestionAfterSpeech: settings.showQuestionAfterSpeech ?? false,
        autoPlayQuestion: settings.autoPlayQuestion ?? true
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    return NextResponse.json({ success: false, error: '获取设置失败' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    
    if (!token) {
      return NextResponse.json({ success: false, error: '未登录' }, { status: 401 });
    }

    const userId = verifyToken(token);
    if (!userId) {
      return NextResponse.json({ success: false, error: '登录已过期' }, { status: 401 });
    }

    const body = await request.json();
    const { defaultVoice, voiceSpeed, showQuestionAfterSpeech, autoPlayQuestion } = body;

    const updateData: Record<string, unknown> = {};
    if (defaultVoice !== undefined) updateData.defaultVoice = defaultVoice;
    if (voiceSpeed !== undefined) updateData.voiceSpeed = voiceSpeed;
    if (showQuestionAfterSpeech !== undefined) updateData.showQuestionAfterSpeech = showQuestionAfterSpeech;
    if (autoPlayQuestion !== undefined) updateData.autoPlayQuestion = autoPlayQuestion;

    const settings = await db.userSettings.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        defaultVoice: defaultVoice || 'us-female',
        voiceSpeed: voiceSpeed ?? 1.0,
        showQuestionAfterSpeech: showQuestionAfterSpeech ?? false,
        autoPlayQuestion: autoPlayQuestion ?? true
      }
    });

    return NextResponse.json({
      success: true,
      settings: {
        defaultVoice: settings.defaultVoice,
        voiceSpeed: settings.voiceSpeed,
        showQuestionAfterSpeech: settings.showQuestionAfterSpeech,
        autoPlayQuestion: settings.autoPlayQuestion
      }
    });
  } catch (error) {
    console.error('Update settings error:', error);
    return NextResponse.json({ success: false, error: '保存设置失败' }, { status: 500 });
  }
}
