import { PrismaClient, PointsMode, QuestionType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data in dependency order
  await prisma.answer.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.session.deleteMany();
  await prisma.option.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Cleaned existing database records.');

  // Create a default host user
  const passwordHash = await bcrypt.hash('Password123', 10);
  const host = await prisma.user.create({
    data: {
      email: 'teacher@example.com',
      name: 'Jane Doe',
      passwordHash,
    },
  });

  console.log(`👤 Created host user: ${host.email} (Password: Password123)`);

  // Create a demo Quiz
  const quiz = await prisma.quiz.create({
    data: {
      hostId: host.id,
      title: 'HTML & CSS Foundations',
      description: 'Test your core understanding of web layout, CSS selectors, and semantic HTML.',
      timePerQuestion: 20,
      pointsMode: PointsMode.STANDARD,
      shuffleQuestions: false,
      shuffleOptions: true,
      showLeaderboardBetweenQuestions: true,
      allowLateJoin: true,
    },
  });

  console.log(`📝 Created quiz: "${quiz.title}"`);

  // Create Question 1: MCQ Single
  const q1 = await prisma.question.create({
    data: {
      quizId: quiz.id,
      order: 1,
      text: 'Which HTML5 element represents self-contained content, such as a forum post, magazine article, or blog entry?',
      type: QuestionType.MCQ_SINGLE,
      points: 1000,
      explanation: 'The <article> element is specifically designed for self-contained, syndicatable content.',
    },
  });

  await prisma.option.createMany({
    data: [
      { questionId: q1.id, text: '<section>', isCorrect: false },
      { questionId: q1.id, text: '<article>', isCorrect: true },
      { questionId: q1.id, text: '<aside>', isCorrect: false },
      { questionId: q1.id, text: '<div>', isCorrect: false },
    ],
  });

  // Create Question 2: MCQ Single
  const q2 = await prisma.question.create({
    data: {
      quizId: quiz.id,
      order: 2,
      text: 'What does CSS stand for?',
      type: QuestionType.MCQ_SINGLE,
      points: 1000,
      explanation: 'CSS stands for Cascading Style Sheets, describing how HTML elements are to be displayed.',
    },
  });

  await prisma.option.createMany({
    data: [
      { questionId: q2.id, text: 'Computer Style Sheets', isCorrect: false },
      { questionId: q2.id, text: 'Creative Style Sheets', isCorrect: false },
      { questionId: q2.id, text: 'Cascading Style Sheets', isCorrect: true },
      { questionId: q2.id, text: 'Colorful Style Sheets', isCorrect: false },
    ],
  });

  // Create Question 3: True / False
  const q3 = await prisma.question.create({
    data: {
      quizId: quiz.id,
      order: 3,
      text: 'In CSS flexbox, flex-direction: row-reverse lays items out from right to left (in left-to-right writing modes).',
      type: QuestionType.TRUE_FALSE,
      points: 800,
      explanation: 'Correct! row-reverse flips the main start and main end lines of the flex container.',
    },
  });

  await prisma.option.createMany({
    data: [
      { questionId: q3.id, text: 'True', isCorrect: true },
      { questionId: q3.id, text: 'False', isCorrect: false },
    ],
  });

  // Create Question 4: MCQ Single
  const q4 = await prisma.question.create({
    data: {
      quizId: quiz.id,
      order: 4,
      text: 'Which CSS selector selects all elements of type <p> that are placed immediately after <div> elements?',
      type: QuestionType.MCQ_SINGLE,
      points: 1200,
      explanation: 'The adjacent sibling combinator (+) matches the second element only if it immediately follows the first.',
    },
  });

  await prisma.option.createMany({
    data: [
      { questionId: q4.id, text: 'div p', isCorrect: false },
      { questionId: q4.id, text: 'div > p', isCorrect: false },
      { questionId: q4.id, text: 'div + p', isCorrect: true },
      { questionId: q4.id, text: 'div ~ p', isCorrect: false },
    ],
  });

  // Create Question 5: True / False
  const q5 = await prisma.question.create({
    data: {
      quizId: quiz.id,
      order: 5,
      text: 'The HTML <head> element is where the main body content of the webpage is displayed to users.',
      type: QuestionType.TRUE_FALSE,
      points: 1000,
      explanation: 'False. The <head> contains metadata, document title, styles and scripts. Visible content belongs inside <body>.',
    },
  });

  await prisma.option.createMany({
    data: [
      { questionId: q5.id, text: 'True', isCorrect: false },
      { questionId: q5.id, text: 'False', isCorrect: true },
    ],
  });

  console.log(`✨ Seeded 5 questions for quiz "${quiz.title}".`);
  console.log('🌱 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
