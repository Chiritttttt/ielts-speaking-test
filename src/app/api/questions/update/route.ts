import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { callDeepSeek } from '@/lib/deepseek';

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

    let prompt: string;
    
    if (partNumber === 1) {
      prompt = `You are an IELTS Speaking examiner. Generate ${count} authentic IELTS Speaking Part 1 questions on the topic: "${topic}"

## Part 1 Format (Introduction and Interview, 4-5 minutes):
- Simple, everyday topics familiar to test takers
- Questions about personal experiences, preferences, and opinions
- Each question expects a 20-30 second response

## CRITICAL: Questions MUST be ordered from EASY to DIFFICULT:
1. **First 1-2 questions (Easy)**: Simple factual questions
   - "Where is your hometown?" / "What do you do?" / "Do you have any hobbies?"
   
2. **Middle questions (Medium)**: Opinion/preference questions
   - "What do you like most about...?" / "Why did you choose...?"
   
3. **Last questions (Harder)**: Evaluation/hypothetical questions
   - "Do you think...?" / "Would you prefer to...?" / "How has... changed?"

Output JSON format only (no markdown):
{
  "questions": [
    {
      "question": "<question text>",
      "category": "${topic}",
      "difficulty": "easy|medium|hard"
    }
  ]
}`;
    } else if (partNumber === 2) {
      prompt = `You are an IELTS Speaking examiner. Generate ${count} authentic IELTS Speaking Part 2 cue cards on the topic: "${topic}"

## Part 2 Format (Individual Long Turn, 3-4 minutes):
- A cue card with a main topic and bullet point prompts
- Test taker has 1 minute to prepare, 1-2 minutes to speak

## Cue Card Structure:
1. Main instruction: "Describe a [person/place/object/event/situation]..."
2. Bullet points should guide from FACTUAL to ABSTRACT:
   - First 1-2 points: WHO/WHAT/WHEN/WHERE (easy - factual)
   - Middle point: WHY/HOW (medium - explanatory)
   - Final point: "and explain..." (harder - evaluation/reflection)

Output JSON format only (no markdown):
{
  "questions": [
    {
      "question": "Describe a ${topic.toLowerCase()}...\\n\\nYou should say:\\n- <point 1>\\n- <point 2>\\n- <point 3>\\nand explain <point 4>.",
      "category": "${topic}",
      "difficulty": "medium"
    }
  ]
}`;
    } else {
      prompt = `You are an IELTS Speaking examiner. Generate ${count} authentic IELTS Speaking Part 3 discussion questions on the topic: "${topic}"

## Part 3 Format (Two-Way Discussion, 4-5 minutes):
- Abstract, analytical questions related to broader themes
- Requires critical thinking and extended responses (30-60 seconds each)

## Questions MUST be ordered from EASY to DIFFICULT:
1. **First question (Easy - Descriptive)**: 
   - "What are the main types of...?" / "How do people typically...?"
2. **Second question (Medium - Comparative)**:
   - "How has... changed over the years?" / "What are the differences between...?"
3. **Third question (Medium-Hard - Evaluative)**:
   - "What are the advantages and disadvantages of...?" / "Why do you think...?"
4. **Fourth question (Hard - Speculative)**:
   - "Do you think... will... in the future?" / "What would happen if...?"
5. **Fifth question (Hardest - Abstract)**:
   - "What role does... play in society?" / "To what extent should...?"

Output JSON format only (no markdown):
{
  "questions": [
    {
      "question": "<question text>",
      "category": "${topic}",
      "difficulty": "easy|medium|hard"
    }
  ]
}`;
    }

    const result = await callDeepSeek([
      { 
        role: 'system', 
        content: 'You are an expert IELTS examiner. Generate high-quality IELTS Speaking questions. Always respond with valid JSON only, no markdown code blocks.' 
      },
      { role: 'user', content: prompt }
    ], { temperature: 0.8 });

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

    const savedQuestions = [];
    for (const q of questions.questions || []) {
      try {
        const difficulty = q.difficulty || (partNumber === 1 ? 'easy' : partNumber === 2 ? 'medium' : 'hard');
        
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
