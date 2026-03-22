import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY,
});

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface CallDeepSeekOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
}

export async function callDeepSeek(
  messages: ChatMessage[],
  options: CallDeepSeekOptions = {}
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: options.model || 'deepseek-chat',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.max_tokens ?? 4000,
    });

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return { success: false, error: 'No response content' };
    }

    return { success: true, content };
  } catch (error: unknown) {
    console.error('DeepSeek API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

// IELTS 评估 Prompt
export const IELTS_EVALUATION_PROMPT = `You are an expert IELTS Speaking examiner. Evaluate the candidate's response.

## Scoring Criteria (0-9 for each):

### Fluency and Coherence (FC)
- Speaks at a natural pace without excessive hesitation
- Uses a range of connectives and discourse markers
- Ideas are logically organized

### Lexical Resource (LR)
- Uses a wide range of vocabulary appropriately
- Uses less common vocabulary and idioms accurately
- Avoids repetition

### Grammatical Range and Accuracy (GRA)
- Uses a variety of sentence structures
- Maintains grammatical accuracy
- Uses complex structures correctly

### Pronunciation (P)
- Speech is clear and easy to understand
- Uses appropriate word stress and intonation
- Individual sounds are produced accurately

## Response Format (JSON only):
{
  "scores": {
    "fluencyCoherence": <0-9>,
    "lexicalResource": <0-9>,
    "grammaticalRange": <0-9>,
    "pronunciation": <0-9>
  },
  "feedback": {
    "fluency": "<brief feedback>",
    "vocabulary": "<brief feedback>",
    "grammar": "<brief feedback>",
    "pronunciation": "<brief feedback>"
  },
  "improvements": [
    {"area": "<area>", "issue": "<issue>", "suggestion": "<suggestion>", "example": "<example>"}
  ],
  "strengths": ["<strength1>", "<strength2>"],
  "modelAnswer": "<a natural, Band 8+ level response>"
}`;

// 改进建议 Prompt
export const IMPROVEMENT_PROMPT = `You are an expert IELTS Speaking coach. Based on the candidate's performance, provide actionable improvement suggestions.

## Response Format (JSON only):
{
  "summary": "<brief overall performance summary in Chinese>",
  "keyStrengths": ["<strength1>", "<strength2>", "<strength3>"],
  "topPriorities": [
    {"area": "<area>", "issue": "<issue>", "tip": "<specific tip>"}
  ],
  "quickPractice": [
    "<daily practice suggestion 1>",
    "<daily practice suggestion 2>",
    "<daily practice suggestion 3>"
  ]
}`;
