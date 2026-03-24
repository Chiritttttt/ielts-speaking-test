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

// 解析 AI 返回的 JSON，支持多种格式
function parseQuestionsJSON(content: string): { questions: Array<{ question: string; difficulty: string }> } | null {
  if (!content) return null;
  
  try {
    // 清理常见格式问题
    let jsonStr = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    // 尝试匹配 JSON 对象
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonStr = jsonMatch[0];
    }
    
    const parsed = JSON.parse(jsonStr);
    
    // 验证格式
    if (parsed.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
      // 确保每个问题都有正确的格式
      const validQuestions = parsed.questions.filter((q: any) => {
        return q && typeof q.question === 'string' && q.question.trim().length > 0;
      }).map((q: any) => ({
        question: q.question.trim(),
        difficulty: q.difficulty || 'medium'
      }));
      
      if (validQuestions.length > 0) {
        return { questions: validQuestions };
      }
    }
    
    return null;
  } catch (e) {
    console.error('[Questions] JSON parse error:', e);
    return null;
  }
}

// 生成题目的核心函数（带重试）
async function generateQuestionsWithRetry(
  partNumber: number, 
  topic: string, 
  count: number,
  maxRetries: number = 3
): Promise<{ questions: Array<{ question: string; difficulty: string }> } | null> {
  
  let prompt: string;
  if (partNumber === 1) {
    prompt = PART1_GENERATION_PROMPT(topic, count);
  } else if (partNumber === 2) {
    prompt = PART2_GENERATION_PROMPT(topic, count);
  } else {
    prompt = PART3_GENERATION_PROMPT(topic, count);
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[Questions] Generate attempt ${attempt}/${maxRetries} for Part ${partNumber}, topic: ${topic}`);
    
    const result = await callDeepSeek([
      { 
        role: 'system', 
        content: 'You are an expert IELTS examiner. Generate authentic IELTS Speaking questions that follow the official difficulty progression. Always respond with valid JSON only, no markdown code blocks.' 
      },
      { role: 'user', content: prompt }
    ], { temperature: 0.7 });

    if (!result.success) {
      console.error(`[Questions] API call failed (attempt ${attempt}):`, result.error);
      continue;
    }

    const parsed = parseQuestionsJSON(result.content || '');
    if (parsed && parsed.questions.length > 0) {
      console.log(`[Questions] Successfully parsed ${parsed.questions.length} questions`);
      return parsed;
    }
    
    console.error(`[Questions] Failed to parse response (attempt ${attempt}):`, result.content?.substring(0, 200));
  }
  
  return null;
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

    // 使用带重试的生成函数
    const questionsData = await generateQuestionsWithRetry(partNumber, topic, count, 3);

    if (!questionsData || questionsData.questions.length === 0) {
      return NextResponse.json({
        success: false,
        error: '题目生成失败，请稍后重试'
      }, { status: 500 });
    }

    // 难度排序映射（确保正确排序：easy -> medium -> hard）
    const difficultyOrder: Record<string, number> = { 'easy': 1, 'medium': 2, 'hard': 3 };
    
    // 按难度排序题目
    const sortedQuestions = questionsData.questions.sort((a, b) => {
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

    console.log(`[Questions] Generated ${questionsData.questions.length}, saved ${savedQuestions.length} for Part ${partNumber}, topic: ${topic}`);

    return NextResponse.json({
      success: true,
      generated: questionsData.questions.length,
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
