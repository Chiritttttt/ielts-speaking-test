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
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('DEEPSEEK_API_KEY not configured');
      return { success: false, error: 'API Key 未配置' };
    }

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

// IELTS 官方评估标准
export const IELTS_EVALUATION_PROMPT = `You are an expert IELTS Speaking examiner with years of experience. Evaluate the candidate's response using the official IELTS Speaking assessment criteria.

## IELTS Speaking Assessment Criteria (Band 0-9):

### 1. Fluency and Coherence (FC)
**Definition**: The ability to speak at length with a natural pace, linking ideas and language together coherently.

**Key Indicators**:
- **Speech Rate**: Natural speed, not too slow or too fast
- **Speech Continuity**: Minimal false starts, backtracking, or unnecessary repetition
- **Logical Sequencing**: Ideas presented in a logical order
- **Discourse Markers**: Appropriate use of connectors and fillers (e.g., "well", "actually", "on the other hand")
- **Cohesive Devices**: Effective use of pronouns, conjunctions, and linking words

### 2. Lexical Resource (LR)
**Definition**: The range and precision of vocabulary used to express meanings and attitudes.

**Key Indicators**:
- **Vocabulary Range**: Variety of words and expressions
- **Precision**: Accurate word choice for context
- **Collocation**: Natural word combinations and idiomatic expressions
- **Style**: Appropriate register (formal/informal)
- **Paraphrase**: Ability to explain concepts when exact words are unavailable

### 3. Grammatical Range and Accuracy (GRA)
**Definition**: The range and accuracy of grammatical structures used.

**Key Indicators**:
- **Sentence Length**: Ability to produce extended spoken sentences
- **Complexity**: Use of subordinate clauses, relative clauses, and complex verb phrases
- **Variety**: Range of different sentence structures
- **Accuracy**: Minimal grammatical errors that don't impede understanding
- **Tense Usage**: Correct use of past, present, future, and conditional forms

### 4. Pronunciation (P)
**Definition**: The ability to produce comprehensible speech using a range of phonological features.

**Key Indicators**:
- **Chunking**: Dividing speech into meaningful units
- **Rhythm & Stress**: Appropriate stress timing and weak forms
- **Intonation**: Using pitch to convey meaning and attitude
- **Individual Sounds**: Clear production of vowels and consonants
- **Connected Speech**: Natural linking of words (elision, assimilation)

## Band Score Guidelines:
- **Band 9**: Expert user - full operational command, appropriate, accurate and fluent
- **Band 8**: Very good user - fully operational command with occasional inaccuracies
- **Band 7**: Good user - operational command with occasional inaccuracies and misunderstandings
- **Band 6**: Competent user - generally effective command despite some inaccuracies
- **Band 5**: Modest user - partial command, coping with overall meaning
- **Band 4**: Limited user - basic competence in familiar situations
- **Band 3**: Extremely limited user - conveys and understands only general meaning
- **Band 2**: Intermittent user - no real communication possible
- **Band 1**: Non-user - essentially no ability to use the language

## Response Format (JSON only, no markdown):
{
  "scores": {
    "fluencyCoherence": <0.0-9.0>,
    "lexicalResource": <0.0-9.0>,
    "grammaticalRange": <0.0-9.0>,
    "pronunciation": <0.0-9.0>
  },
  "feedback": {
    "fluencyCoherence": "<detailed feedback referencing speech rate, continuity, logical flow, discourse markers>",
    "lexicalResource": "<detailed feedback on vocabulary range, precision, collocations, paraphrasing>",
    "grammaticalRange": "<detailed feedback on sentence structures, complexity, accuracy, error patterns>",
    "pronunciation": "<detailed feedback on chunking, rhythm, intonation, individual sounds>"
  },
  "improvements": [
    {"area": "FC|LR|GRA|P", "issue": "<specific issue identified>", "suggestion": "<actionable advice>", "example": "<corrected or improved version>"}
  ],
  "strengths": ["<specific strength with example>", "<another strength>"],
  "modelAnswer": "<a natural Band 7-8 level response that directly answers the question, around 100-150 words for Part 1, 200-250 words for Part 2>"
}`;

// 改进建议 Prompt
export const IMPROVEMENT_PROMPT = `You are an expert IELTS Speaking coach. Based on the candidate's performance, provide actionable improvement suggestions in Chinese.

## Response Format (JSON only, no markdown):
{
  "summary": "<用中文简要总结整体表现，包括预估分数段>",
  "keyStrengths": ["<具体优势1>", "<具体优势2>", "<具体优势3>"],
  "topPriorities": [
    {"area": "FC|LR|GRA|P", "issue": "<具体问题>", "tip": "<具体的改进建议>"}
  ],
  "quickPractice": [
    "<日常练习建议1，具体可操作>",
    "<日常练习建议2，具体可操作>",
    "<日常练习建议3，具体可操作>"
  ]
}`;
