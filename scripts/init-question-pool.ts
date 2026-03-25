import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Part 1 题目模板
const part1Questions = [
  // Hometown
  { category: "Hometown", questions: [
    "Let's talk about your hometown. Where are you from?",
    "What do you like most about living there?",
    "Has your hometown changed much in recent years?",
    "Would you like to live there in the future?",
    "What is the most interesting part of your hometown?"
  ]},
  // Work & Study
  { category: "Work & Study", questions: [
    "Do you work or are you a student?",
    "What do you enjoy most about your work or studies?",
    "What are your future career plans?",
    "Is there anything you dislike about your work or studies?",
    "What was your favorite subject at school?"
  ]},
  // Leisure
  { category: "Leisure", questions: [
    "What do you usually do in your free time?",
    "Do you prefer spending your free time alone or with others?",
    "How has your free time changed since you were a child?",
    "Do you think it's important to have hobbies?",
    "What new hobby would you like to try?"
  ]},
  // Technology
  { category: "Technology", questions: [
    "How often do you use the internet?",
    "What electronic devices do you use most?",
    "Do you think technology has improved people's lives?",
    "How has technology changed the way you work or study?",
    "Are there any disadvantages of modern technology?"
  ]},
  // Travel
  { category: "Travel", questions: [
    "Do you like traveling?",
    "What is the most interesting place you have visited?",
    "Where would you like to travel in the future?",
    "Do you prefer traveling alone or with others?",
    "What do you usually do when you visit a new place?"
  ]},
  // Food
  { category: "Food", questions: [
    "What is your favorite food?",
    "Do you like trying new foods?",
    "How often do you eat out?",
    "Can you cook? What dishes can you make?",
    "What is a typical meal in your country?"
  ]},
  // Music
  { category: "Music", questions: [
    "What kind of music do you like?",
    "Do you play any musical instruments?",
    "Have you ever been to a concert?",
    "How has your taste in music changed over time?",
    "Do you prefer listening to music alone or with others?"
  ]},
  // Sports
  { category: "Sports", questions: [
    "Do you like sports?",
    "What sports do you enjoy watching or playing?",
    "How often do you exercise?",
    "What is the most popular sport in your country?",
    "Do you think children should learn to play sports?"
  ]}
];

// Part 2 题目模板
const part2Questions = [
  { category: "Person", questions: [
    "Describe a person who has influenced you.\n\nYou should say:\n- who this person is\n- how you know them\n- what they have done to influence you\n- and explain why they have been important in your life.",
    "Describe a famous person you would like to meet.\n\nYou should say:\n- who this person is\n- what they are famous for\n- what you would like to ask them\n- and explain why you would like to meet them."
  ]},
  { category: "Place", questions: [
    "Describe a place you would like to visit.\n\nYou should say:\n- where this place is\n- how you learned about it\n- what you would do there\n- and explain why you would like to visit it.",
    "Describe a quiet place you like.\n\nYou should say:\n- where this place is\n- how often you go there\n- what you do there\n- and explain why you like this quiet place."
  ]},
  { category: "Experience", questions: [
    "Describe a memorable trip you have taken.\n\nYou should say:\n- where you went\n- when you went there\n- what you did during the trip\n- and explain why this trip was memorable.",
    "Describe a time when you tried something new.\n\nYou should say:\n- what you tried\n- when you tried it\n- whether it was difficult\n- and explain how you felt about trying something new."
  ]},
  { category: "Skill", questions: [
    "Describe a skill you would like to learn.\n\nYou should say:\n- what skill it is\n- why you want to learn it\n- how you would learn it\n- and explain how this skill would be useful to you.",
    "Describe a skill you have learned that is useful.\n\nYou should say:\n- what the skill is\n- how you learned it\n- how often you use it\n- and explain why it is useful to you."
  ]},
  { category: "Object", questions: [
    "Describe a gift you received that was important to you.\n\nYou should say:\n- what the gift was\n- who gave it to you\n- when you received it\n- and explain why this gift was important to you.",
    "Describe an object that you use every day.\n\nYou should say:\n- what the object is\n- how long you have had it\n- what you use it for\n- and explain why it is important to you."
  ]},
  { category: "Event", questions: [
    "Describe a celebration that was important to you.\n\nYou should say:\n- what the celebration was\n- when it took place\n- who was involved\n- and explain why it was important to you.",
    "Describe a difficult challenge you faced.\n\nYou should say:\n- what the challenge was\n- when it happened\n- how you dealt with it\n- and explain what you learned from this experience."
  ]}
];

// Part 3 题目模板
const part3Questions = [
  { category: "Education", questions: [
    "What skills do you think are most important for young people to learn today?",
    "How has education changed in your country over the years?",
    "Do you think practical skills or academic knowledge is more valuable?",
    "What role should schools play in developing students' life skills?",
    "How can technology improve education?",
    "What are the advantages and disadvantages of online learning?"
  ]},
  { category: "Society", questions: [
    "How has family life changed in your country over the years?",
    "What are the biggest challenges facing society today?",
    "Do you think people are more or less connected than in the past?",
    "What role should the government play in solving social problems?",
    "How can individuals contribute to making society better?",
    "What social issues are most important to young people?"
  ]},
  { category: "Technology", questions: [
    "How has technology changed the way people work?",
    "Do you think technology has improved or harmed social relationships?",
    "What are the potential dangers of new technology?",
    "How can we ensure technology is used responsibly?",
    "What technological developments do you expect in the future?",
    "Should there be limits on how technology is used?"
  ]},
  { category: "Environment", questions: [
    "What are the biggest environmental problems in your country?",
    "How can individuals help protect the environment?",
    "What role should governments play in environmental protection?",
    "Do you think businesses are doing enough to protect the environment?",
    "How has climate change affected your country?",
    "What environmental issues will be most important in the future?"
  ]},
  { category: "Culture", questions: [
    "How important is it to preserve traditional culture?",
    "How has globalization affected local culture?",
    "What can young people learn from older generations?",
    "Should cultural traditions be adapted for modern times?",
    "How has art and music changed in your country?",
    "What role does culture play in shaping identity?"
  ]},
  { category: "Work", questions: [
    "How has the workplace changed in recent years?",
    "What skills will be most important for future jobs?",
    "Do you think people will work more or less in the future?",
    "What are the advantages and disadvantages of remote work?",
    "How can people achieve a good work-life balance?",
    "What makes a job satisfying?"
  ]}
];

async function main() {
  console.log('Creating default question pool...');

  // 创建默认题库
  const pool = await prisma.questionPool.create({
    data: {
      name: '2025年1-4月雅思口语题库',
      description: '2025年第一季度雅思口语预测题库',
      period: '2025-Q1',
      isActive: true,
      isDefault: true,
      source: 'official'
    }
  });

  console.log('Created pool:', pool.name);

  let part1Count = 0;
  let part2Count = 0;
  let part3Count = 0;

  // 插入 Part 1 题目
  console.log('Adding Part 1 questions...');
  for (const topic of part1Questions) {
    for (const questionText of topic.questions) {
      await prisma.questionBank.create({
        data: {
          partNumber: 1,
          category: topic.category,
          questionText,
          difficulty: 'easy',
          poolId: pool.id
        }
      });
      part1Count++;
    }
  }

  // 插入 Part 2 题目
  console.log('Adding Part 2 questions...');
  for (const topic of part2Questions) {
    for (const questionText of topic.questions) {
      await prisma.questionBank.create({
        data: {
          partNumber: 2,
          category: topic.category,
          questionText,
          difficulty: 'medium',
          poolId: pool.id
        }
      });
      part2Count++;
    }
  }

  // 插入 Part 3 题目
  console.log('Adding Part 3 questions...');
  for (const topic of part3Questions) {
    for (const questionText of topic.questions) {
      await prisma.questionBank.create({
        data: {
          partNumber: 3,
          category: topic.category,
          questionText,
          difficulty: 'hard',
          poolId: pool.id
        }
      });
      part3Count++;
    }
  }

  // 更新题库统计
  await prisma.questionPool.update({
    where: { id: pool.id },
    data: {
      part1Count,
      part2Count,
      part3Count
    }
  });

  console.log(`\nQuestion pool initialized successfully!`);
  console.log(`Part 1: ${part1Count} questions`);
  console.log(`Part 2: ${part2Count} questions`);
  console.log(`Part 3: ${part3Count} questions`);
  console.log(`Total: ${part1Count + part2Count + part3Count} questions`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
