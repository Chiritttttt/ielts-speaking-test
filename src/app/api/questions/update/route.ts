import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callDeepSeek, PART1_GENERATION_PROMPT, PART2_GENERATION_PROMPT, PART3_GENERATION_PROMPT } from '@/lib/deepseek';

// Check server API key status
export async function POST(request: NextRequest) {
  try {
    const hasServerKey = !!process.env.DEEPSEEK_API_KEY;
    
    return NextResponse.json({
      success: true,
      hasServerKey,
      message: hasServerKey 
        ? '服务已就绪' 
        : '服务未配置，请联系管理员'
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Check failed'
    }, { status: 500 });
  }
}

// Generate new questions
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { part, topic, count = 5 } = body;

    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({
        success: false,
        error: '服务未配置，请联系管理员'
      }, { status: 500 });
    }

    if (!part || !topic) {
      return NextResponse.json({
        success: false,
        error: '请选择题目部分和话题'
      }, { status: 400 });
    }

    const partNumber = parseInt(part);
    if (partNumber < 1 || partNumber > 3) {
      return NextResponse.json({
        success: false,
        error: '无效的题目部分'
      }, { status: 400 });
    }

    // 根据不同 Part 选择对应的 Prompt
    let prompt: string;
    if (partNumber === 1) {
      prompt = PART1_GENERATION_PROMPT(topic, count);
    } else if (partNumber === 2) {
      prompt = PART2_GENERATION_PROMPT(topic, count);
    } else {
      prompt = PART3_GENERATION_PROMPT(topic, count);
    }

    const result = await callDeepSeek([
      { 
        role: 'system', 
        content: 'You are an expert IELTS examiner. Generate authentic IELTS Speaking questions that follow the official difficulty progression. Always respond with valid JSON only, no markdown code blocks.' 
      },
      { role: 'user', content: prompt }
    ], { temperature: 0.7 });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: `API 调用失败: ${result.error}`
      }, { status: 500 });
    }

    let questions;
    try {
      let jsonStr = result.content || '';
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      questions = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse:', result.content);
      return NextResponse.json({
        success: false,
        error: 'AI 返回格式解析失败，请重试'
      }, { status: 500 });
    }

    // 难度排序映射（确保正确排序：easy -> medium -> hard）
    const difficultyOrder: Record<string, number> = { 'easy': 1, 'medium': 2, 'hard': 3 };
    
    // 按难度排序题目
    const sortedQuestions = (questions.questions || []).sort((a: any, b: any) => {
      return (difficultyOrder[a.difficulty] || 2) - (difficultyOrder[b.difficulty] || 2);
    });

    const savedQuestions = [];
    for (let i = 0; i < sortedQuestions.length; i++) {
      const q = sortedQuestions[i];
      try {
        const difficulty = q.difficulty || 'medium';
        
        const saved = await db.questionBank.create({
          data: {
            partNumber,
            category: topic,
            questionText: q.question,
            difficulty
          }
        });
        savedQuestions.push(saved);
      } catch {
        // Skip duplicates or errors
      }
    }

    console.log(`[Questions] Generated ${questions.questions?.length || 0}, saved ${savedQuestions.length} for Part ${partNumber}, topic: ${topic}`);

    return NextResponse.json({
      success: true,
      generated: questions.questions?.length || 0,
      saved: savedQuestions.length,
      questions: savedQuestions
    });
  } catch (error) {
    console.error('Generate questions error:', error);
    return NextResponse.json({
      success: false,
      error: '生成题目失败'
    }, { status: 500 });
  }
}

// Get available topics
export async function GET() {
  const topics = {
    part1: ['Hometown', 'Work & Study', 'Technology', 'Leisure', 'Food', 'Travel', 'Family', 'Friends', 'Music', 'Movies', 'Sports', 'Reading'],
    part2: ['Person', 'Place', 'Experience', 'Skill', 'Object', 'Event', 'Book', 'Movie', 'Travel', 'Achievement', 'Challenge', 'Gift'],
    part3: ['Education', 'Society', 'Environment', 'Technology', 'Culture', 'Health', 'Work', 'Relationships', 'Media', 'Globalization']
  };
  
  return NextResponse.json({
    success: true,
    topics
  });
}
