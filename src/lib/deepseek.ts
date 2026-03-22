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

// Part 1 题目生成 Prompt（从"你"开始，浅层一般化）
export function PART1_GENERATION_PROMPT(topic: string, count: number): string {
  return `You are an IELTS Speaking examiner. Generate ${count} authentic IELTS Speaking Part 1 questions on the topic: "${topic}"

## Part 1 Overview:
Part 1 is a warm-up section where the examiner asks simple questions about "YOU" - your personal experiences, background, and preferences. No abstract thinking is required.

## Question Order - From EASY to DIFFICULT:

**Questions 1-2 (Difficulty: "easy") - Identity & Basic Facts:**
Start with the MOST GENERAL questions about identity and background.
Examples:
- "Where are you from?" / "What do you do?" / "Do you work or are you a student?"
- "Tell me about your hometown." / "How long have you lived there?"
These questions require simple factual answers about yourself.

**Questions 3-4 (Difficulty: "medium") - Preferences & Habits:**
Move to questions about your preferences, habits, and routines.
Examples:
- "What do you enjoy most about your job/studies?"
- "What kind of ${topic.toLowerCase()} do you like?"
- "How often do you ${topic.toLowerCase()}?"
- "Do you prefer X or Y? Why?"
These questions require explanation of personal preferences.

**Question 5 (Difficulty: "hard") - Changes & Evaluation:**
End with questions about changes or your opinion on trends.
Examples:
- "Has your hometown changed much in recent years?"
- "Do you think ${topic.toLowerCase()} has become more/less popular? Why?"
- "How has ${topic.toLowerCase()} changed since you were a child?"
These questions require comparing past and present or expressing opinions.

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

// Part 2 题目生成 Prompt（给定具体话题，展开叙述）
export function PART2_GENERATION_PROMPT(topic: string, count: number): string {
  return `You are an IELTS Speaking examiner. Generate ${count} authentic IELTS Speaking Part 2 cue cards on the topic: "${topic}"

## Part 2 Overview:
Part 2 is an individual long turn. You receive a cue card with a main topic + 3-4 bullet point prompts. You have 1 minute to prepare and 1-2 minutes to speak.

## Cue Card Structure - From GENERAL to SPECIFIC:

Each cue card should follow this structure:
1. **Main topic**: "Describe a [person/place/object/event/experience]..."
2. **Bullet points ordered from factual to evaluative:**
   - **Point 1 (Factual - easy)**: WHO/WHAT/WHEN/WHERE
   - **Point 2 (Descriptive - medium)**: Details about appearance, characteristics
   - **Point 3 (Explanatory - medium)**: WHY/HOW - reasons and process
   - **Point 4 (Evaluative - hard)**: "and explain..." - feelings, opinions, significance

## Example Format:
"Describe a memorable journey you have had.

You should say:
- Where you went
- Who you went with  
- What you did during the journey
And explain why it was memorable to you."

The progression: WHERE (fact) → WHO (fact) → WHAT (action) → WHY (evaluation)

Output JSON format only (no markdown):
{
  "questions": [
    {
      "question": "Describe a ${topic.toLowerCase()}...\\n\\nYou should say:\\n- <factual point 1 - where/when/who>\\n- <descriptive point 2 - what/details>\\n- <explanatory point 3 - how/why>\\nAnd explain <evaluative point 4 - feelings/significance>.",
      "category": "${topic}",
      "difficulty": "medium"
    }
  ]
}`;
}

// Part 3 题目生成 Prompt（从具体案例上升到一般性讨论）
export function PART3_GENERATION_PROMPT(topic: string, count: number): string {
  return `You are an IELTS Speaking examiner. Generate ${count} authentic IELTS Speaking Part 3 discussion questions on the topic: "${topic}"

## Part 3 Overview:
Part 3 is the highest difficulty section. Questions move from specific cases to GENERAL discussions about society, culture, trends, and the future. You need analysis, comparison, examples, and speculation skills.

## Question Order - From SPECIFIC to ABSTRACT:

**Question 1 (Difficulty: "easy") - Specific Extension:**
Extend from "you" to "some people" - still relatively concrete.
Examples:
- "Why do some people prefer to ${topic.toLowerCase()}?"
- "What makes people want to ${topic.toLowerCase()}?"
Focus: Reasons behind individual choices.

**Question 2 (Difficulty: "medium") - Comparison (Time/Group):**
Compare across time periods or different groups.
Examples:
- "How has ${topic.toLowerCase()} changed over the past 20 years?"
- "What are the differences between how young people and older people view ${topic.toLowerCase()}?"
Focus: Comparing past vs present, or different demographics.

**Question 3 (Difficulty: "medium") - Pros and Cons:**
Analyze advantages and disadvantages.
Examples:
- "What are the advantages and disadvantages of ${topic.toLowerCase()}?"
- "What are the benefits of ${topic.toLowerCase()} for society?"
Focus: Balanced analysis.

**Question 4 (Difficulty: "hard") - Future Speculation:**
Speculate about future trends and possibilities.
Examples:
- "Do you think ${topic.toLowerCase()} will become more or less popular in the future? Why?"
- "How might technology change the way people ${topic.toLowerCase()} in the future?"
Focus: Prediction with reasoning.

**Question 5 (Difficulty: "hard") - Abstract/Societal:**
Most abstract - discuss broader societal implications.
Examples:
- "What impact does ${topic.toLowerCase()} have on society as a whole?"
- "To what extent should the government be involved in ${topic.toLowerCase()}?"
- "What role does ${topic.toLowerCase()} play in modern culture?"
Focus: Abstract thinking, societal impact, policy implications.

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
