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

// IELTS 官方评估标准 - 基础版（不包含model answer）
export const IELTS_EVALUATION_BASE = `You are an expert IELTS Speaking examiner with years of experience. Evaluate the candidate's response using the official IELTS Speaking assessment criteria.

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
- **Paraphrase**: Ability to explain concepts when exact words are unavailable

### 3. Grammatical Range and Accuracy (GRA)
**Definition**: The range and accuracy of grammatical structures used.

**Key Indicators**:
- **Sentence Length**: Ability to produce extended spoken sentences
- **Complexity**: Use of subordinate clauses, relative clauses, and complex verb phrases
- **Variety**: Range of different sentence structures
- **Accuracy**: Minimal grammatical errors that don't impede understanding

### 4. Pronunciation (P)
**Definition**: The ability to produce comprehensible speech using a range of phonological features.

**Key Indicators**:
- **Chunking**: Dividing speech into meaningful units
- **Rhythm & Stress**: Appropriate stress timing and weak forms
- **Intonation**: Using pitch to convey meaning and attitude
- **Individual Sounds**: Clear production of vowels and consonants

## Band Score Guidelines:
- **Band 9**: Expert user - full operational command, appropriate, accurate and fluent
- **Band 8**: Very good user - fully operational command with occasional inaccuracies
- **Band 7**: Good user - operational command with occasional inaccuracies
- **Band 6**: Competent user - generally effective command despite some inaccuracies
- **Band 5**: Modest user - partial command, coping with overall meaning`;

// Part 1 评估 Prompt
export function IELTS_PART1_EVALUATION_PROMPT(partNumber: number): string {
  return `${IELTS_EVALUATION_BASE}

## Part ${partNumber} Model Answer Requirements (SPOKEN English, Band 7-8):

**Length**: 40-60 words (about 20-30 seconds of speech)
**Style**: Natural, conversational, personal - like talking to a friend

**Structure**:
1. **Direct Answer**: Answer the question directly in 1 sentence
2. **Explanation/Example**: Add 1-2 sentences explaining why or giving a specific example
3. **Optional Extension**: A brief additional detail if natural

**Language Features for High Score**:
- Use natural fillers: "Well,", "Actually,", "To be honest,", "I suppose"
- Vary sentence openings: avoid repeating "I think..." or "I like..."
- Include personal details: names, places, specific times
- Use contractions naturally: "I've", "don't", "can't"
- Add feelings/opinions: "I really enjoy...", "It's quite..."

**Example Question**: "What do you enjoy most about your job?"
**Model Answer (Band 7-8)**:
"Well, I'd say the best part is definitely the people I work with - they're really supportive and we have a great laugh together. Also, I quite like the variety - no two days are ever the same, which keeps things interesting for me."

**NOTICE - This is SPOKEN English**:
- ✅ Use contractions (I've, don't, it's)
- ✅ Include natural fillers (well, actually, I mean)
- ✅ Use informal vocabulary (great laugh, quite like, things)
- ✅ Vary sentence length (mix short and longer sentences)
- ❌ Do NOT use formal academic language
- ❌ Do NOT write long, complex sentences
- ❌ Do NOT use sophisticated vocabulary that sounds unnatural in speech

## Response Format (JSON only, no markdown):
{
  "scores": {
    "fluencyCoherence": <0.0-9.0>,
    "lexicalResource": <0.0-9.0>,
    "grammaticalRange": <0.0-9.0>,
    "pronunciation": <0.0-9.0>
  },
  "feedback": {
    "fluencyCoherence": "<detailed feedback in Simplified Chinese (简体中文)>",
    "lexicalResource": "<detailed feedback in Simplified Chinese (简体中文)>",
    "grammaticalRange": "<detailed feedback in Simplified Chinese (简体中文)>",
    "pronunciation": "<detailed feedback in Simplified Chinese (简体中文)>"
  },
  "improvements": [
    {"area": "FC|LR|GRA|P", "issue": "<具体问题 in 简体中文>", "suggestion": "<改进建议 in 简体中文>", "example": "<改进示例 in English>"}
  ],
  "strengths": ["<具体优势 in 简体中文>", "<另一个优势 in 简体中文>"],
  "modelAnswer": "<Band 7-8 level spoken response, 40-60 words, natural and conversational>"
}`;
}

// Part 2 评估 Prompt
export function IELTS_PART2_EVALUATION_PROMPT(partNumber: number): string {
  return `${IELTS_EVALUATION_BASE}

## Part ${partNumber} Model Answer Requirements (SPOKEN English, Band 7-8):

**Length**: 180-250 words (about 1.5-2 minutes of speech)
**Style**: Narrative storytelling, personal and engaging

**Structure** (Follow the cue card bullet points):
1. **Opening**: Introduce the topic with background (10-15% of response)
2. **Development**: Address each bullet point in sequence (60-70% of response)
3. **Conclusion**: Explain feelings/significance (20-25% of response)

**Language Features for High Score**:
- **Storytelling markers**: "So, basically...", "What happened was...", "The thing is..."
- **Time expressions**: "A few years ago", "Last summer", "When I was..."
- **Descriptive language**: vivid adjectives, sensory details
- **Emotional language**: "I was absolutely delighted", "It was quite overwhelming"
- **Natural pauses**: Use discourse markers to structure the story
- **Variety of tenses**: Past for events, present for description/feelings

**Example Topic**: "Describe a memorable journey"
**Model Answer (Band 7-8)**:
"So I'd like to talk about a trip I took to Japan a couple of years ago, which was really quite unforgettable for several reasons.

First of all, I went there with my best friend from university - we'd been planning this trip for absolutely ages, probably about a year. We decided to go in spring because we wanted to see the cherry blossoms, which was definitely the right choice.

During the journey itself, we visited several cities - Tokyo, Kyoto, and Osaka. The highlight was probably when we got slightly lost in Kyoto and ended up stumbling upon this tiny little temple that wasn't in any guidebook. It was incredibly peaceful there, just us and these beautiful gardens.

What made it so memorable, though, was that it was the first time I'd really travelled independently, without my family. I felt this amazing sense of freedom and discovery. Plus, the whole experience of navigating a completely different culture was both challenging and incredibly rewarding. Even now, looking back at the photos, I can still feel that excitement we had."

**NOTICE - This is SPOKEN English**:
- ✅ Use storytelling phrases ("So, basically", "What happened was")
- ✅ Include specific details (names, places, times)
- ✅ Use a mix of simple and complex sentences
- ✅ Add personal feelings and reactions
- ✅ Use contractions and natural speech patterns
- ❌ Do NOT sound like a written essay
- ❌ Do NOT use overly formal language
- ❌ Do NOT forget to include emotional responses

## Response Format (JSON only, no markdown):
{
  "scores": {
    "fluencyCoherence": <0.0-9.0>,
    "lexicalResource": <0.0-9.0>,
    "grammaticalRange": <0.0-9.0>,
    "pronunciation": <0.0-9.0>
  },
  "feedback": {
    "fluencyCoherence": "<详细反馈，简体中文>",
    "lexicalResource": "<详细反馈，简体中文>",
    "grammaticalRange": "<详细反馈，简体中文>",
    "pronunciation": "<详细反馈，简体中文>"
  },
  "improvements": [
    {"area": "FC|LR|GRA|P", "issue": "<具体问题 in 简体中文>", "suggestion": "<改进建议 in 简体中文>", "example": "<改进示例 in English>"}
  ],
  "strengths": ["<具体优势 in 简体中文>", "<另一个优势 in 简体中文>"],
  "modelAnswer": "<Band 7-8 level spoken narrative, 180-250 words, engaging storytelling style>"
}`;
}

// Part 3 评估 Prompt
export function IELTS_PART3_EVALUATION_PROMPT(partNumber: number): string {
  return `${IELTS_EVALUATION_BASE}

## Part ${partNumber} Model Answer Requirements (SPOKEN English, Band 7-8):

**Length**: 80-120 words (about 40-60 seconds of speech)
**Style**: Analytical, thoughtful discussion - more formal than Part 1 but still spoken

**Structure**:
1. **Direct Response**: Answer the question with a clear position (1 sentence)
2. **Explanation/Reasoning**: Explain your reasoning with 2-3 points (2-3 sentences)
3. **Example/Evidence**: Provide concrete examples or evidence (1-2 sentences)
4. **Concession/Extension**: Acknowledge other viewpoints or extend the discussion (1 sentence, optional)

**Language Features for High Score**:
- **Hedging expressions**: "It depends on...", "In most cases...", "Generally speaking..."
- **Complex structures**: Conditionals ("If... then..."), comparisons, relative clauses
- **Abstract vocabulary**: social impact, cultural factors, economic considerations
- **Linking ideas**: "On the other hand", "In contrast", "For instance", "Moreover"
- **Showing perspective**: "From my point of view", "As I see it", "I would argue that"

**Example Question**: "Do you think technology has changed the way people travel?"
**Model Answer (Band 7-8)**:
"That's an interesting question. I'd say technology has fundamentally transformed travel in several ways. Firstly, with smartphones and apps like Google Maps, people can now navigate foreign countries much more easily - there's less of that sense of adventure and getting lost that used to be part of the experience. Secondly, social media has changed how people choose destinations - they often pick places that will look good on Instagram rather than because of genuine interest. Having said that, technology has made travel more accessible for many people, especially with online booking and translation apps, which I think is largely positive."

**NOTICE - This is SPOKEN discussion English**:
- ✅ Use discourse markers to organize thoughts ("Firstly", "Secondly", "Having said that")
- ✅ Show complex thinking (considering multiple perspectives)
- ✅ Use specific examples to support abstract points
- ✅ Balance formality - not too casual, not too academic
- ✅ Include hedging language ("I'd say", "I think", "largely")
- ❌ Do NOT use bullet-point style responses
- ❌ Do NOT be too brief - develop your points
- ❌ Do NOT forget to include examples
- ❌ Do NOT use written essay style (no "In conclusion", "Furthermore")

## Response Format (JSON only, no markdown):
{
  "scores": {
    "fluencyCoherence": <0.0-9.0>,
    "lexicalResource": <0.0-9.0>,
    "grammaticalRange": <0.0-9.0>,
    "pronunciation": <0.0-9.0>
  },
  "feedback": {
    "fluencyCoherence": "<详细反馈，简体中文>",
    "lexicalResource": "<详细反馈，简体中文>",
    "grammaticalRange": "<详细反馈，简体中文>",
    "pronunciation": "<详细反馈，简体中文>"
  },
  "improvements": [
    {"area": "FC|LR|GRA|P", "issue": "<具体问题 in 简体中文>", "suggestion": "<改进建议 in 简体中文>", "example": "<改进示例 in English>"}
  ],
  "strengths": ["<具体优势 in 简体中文>", "<另一个优势 in 简体中文>"],
  "modelAnswer": "<Band 7-8 level spoken discussion, 80-120 words, analytical with examples>"
}`;
}

// 根据 Part 选择评估 Prompt
export function getEvaluationPrompt(partNumber: number): string {
  if (partNumber === 1) {
    return IELTS_PART1_EVALUATION_PROMPT(1);
  } else if (partNumber === 2) {
    return IELTS_PART2_EVALUATION_PROMPT(2);
  } else {
    return IELTS_PART3_EVALUATION_PROMPT(3);
  }
}

// 兼容旧的常量名
export const IELTS_EVALUATION_PROMPT = IELTS_PART1_EVALUATION_PROMPT(1);

// ============ 题目生成 Prompts ============

// Part 1 题目生成 Prompt - 难度递进：身份认知 → 偏好表达 → 变化比较
export function PART1_GENERATION_PROMPT(topic: string, count: number): string {
  return `Generate ${count} IELTS Speaking Part 1 questions about "${topic}".

## Part 1 Question Difficulty Progression:
Part 1 questions should follow this natural progression:

**Easy Level (1-2 questions)**: Identity/Fact-based questions
- Focus on the candidate themselves ("you", "your")
- Simple present tense, personal information
- Examples: "Where are you from?", "Do you work or study?", "What do you do?"

**Medium Level (2-3 questions)**: Preference/Opinion questions
- Express preferences, likes/dislikes
- Use phrases like "What do you enjoy...", "Do you prefer...", "What's your favorite..."
- Examples: "What do you enjoy most about your job?", "Do you prefer working alone or in a team?"

**Hard Level (1-2 questions)**: Change/Comparison questions
- Past vs present, changes over time
- Future possibilities, hypothetical situations
- Examples: "Has your hometown changed much?", "How is your job different from what you expected?"

## Response Format (JSON only, no markdown):
{
  "questions": [
    {"question": "<question text>", "difficulty": "easy|medium|hard"}
  ]
}`;
}

// Part 2 题目生成 Prompt - Cue Card 结构
export function PART2_GENERATION_PROMPT(topic: string, count: number): string {
  return `Generate ${count} IELTS Speaking Part 2 cue card topics about "${topic}".

## Part 2 Cue Card Structure:
Each cue card must have:
1. **Main topic statement**: "Describe a/the..."
2. **4 bullet points**: Guide what to include
   - What/Who/When/Where (factual)
   - Details about the topic
   - What happened/What you did
   - Explain why/How you felt (extended response)

## Response Format (JSON only, no markdown):
{
  "questions": [
    {
      "question": "Describe [a specific topic].\n\nYou should say:\n- [bullet 1: what/who/when/where]\n- [bullet 2: details]\n- [bullet 3: what happened/did]\n- and explain [bullet 4: why/how you felt].",
      "difficulty": "medium"
    }
  ]
}`;
}

// Part 3 题目生成 Prompt - 从具体到抽象的讨论
export function PART3_GENERATION_PROMPT(topic: string, count: number): string {
  return `Generate ${count} IELTS Speaking Part 3 discussion questions about "${topic}".

## Part 3 Question Difficulty Progression:
Part 3 questions should progress from specific to abstract:

**Easy Level (1 question)**: Direct extension of Part 2 topic
- About the specific topic type
- "What makes a good...", "Why do people..."
- Example: "What makes a memorable trip?"

**Medium Level (2 questions)**: Broader social/cultural context
- Compare past/present, different groups
- "How has... changed", "Do you think... is different for..."
- Example: "How has travel changed in your country over the past 20 years?"

**Hard Level (1-2 questions)**: Abstract/General/Philosophical
- Society-wide implications, future predictions
- "To what extent...", "What role should...", "How might... affect society"
- Example: "To what extent should governments promote domestic tourism?"

## Response Format (JSON only, no markdown):
{
  "questions": [
    {"question": "<question text>", "difficulty": "easy|medium|hard"}
  ]
}`;
}
