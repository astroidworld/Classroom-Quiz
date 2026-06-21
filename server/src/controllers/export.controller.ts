import { Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import Papa from 'papaparse';
import PDFDocument from 'pdfkit';

/**
 * Export full session results as CSV.
 */
export const exportSessionCSV = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const hostId = req.user!.id;

    // Verify session and fetch all answer records
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        quiz: true,
        answers: {
          include: {
            participant: true,
            question: true,
            selectedOption: true,
          },
          orderBy: [
            { participant: { displayName: 'asc' } },
            { question: { order: 'asc' } },
          ],
        },
      },
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }
    if (session.quiz.hostId !== hostId) {
      throw new AppError('Unauthorized access to session data', 403);
    }

    // Map answers to CSV-friendly objects
    const csvData = session.answers.map((ans) => ({
      'Session ID': session.id,
      'Join Code': session.joinCode,
      'Quiz Title': session.quiz.title,
      'Session Mode': session.mode,
      'Student Name': ans.participant.displayName,
      'Question Number': ans.question.order,
      'Question Text': ans.question.text,
      'Selected Option': ans.selectedOption ? ans.selectedOption.text : 'Unanswered',
      'Is Correct': ans.isCorrect ? 'TRUE' : 'FALSE',
      'Auto Submitted': ans.autoSubmitted ? 'TRUE' : 'FALSE',
      'Response Time (ms)': ans.responseTimeMs,
      'Points Awarded': ans.pointsAwarded,
      'Early Submit Bonus': ans.earlyBonus,
      'Negative Penalty': ans.penalty,
      'Answered At': ans.answeredAt.toISOString(),
    }));

    const csvString = Papa.unparse(csvData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="quiz-session-${session.joinCode}-results.csv"`);
    return res.status(200).send(csvString);
  } catch (error) {
    next(error);
  }
};

/**
 * Export a comprehensive PDF Summary Report of the session.
 */
export const exportSessionPDF = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const hostId = req.user!.id;

    // Fetch session details
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                options: true,
              },
            },
          },
        },
        participants: {
          orderBy: { finalScore: 'desc' },
          include: {
            answers: {
              include: {
                question: true,
                selectedOption: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }
    if (session.quiz.hostId !== hostId) {
      throw new AppError('Unauthorized access to session data', 403);
    }

    // Prepare PDF Response Headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="quiz-session-${session.joinCode}-report.pdf"`);

    // Create a new PDF Document
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 40, bottom: 40, left: 45, right: 45 },
      bufferPages: true,
    });

    // Pipe PDF generation stream straight to response
    doc.pipe(res);

    // Styling Palette Constants
    const primaryColor = '#0f172a'; // slate-900
    const secondaryColor = '#4f46e5'; // indigo-600
    const textColor = '#1e293b'; // slate-800
    const lightGrey = '#f1f5f9'; // slate-100
    const borderGrey = '#cbd5e1'; // slate-300
    const correctGreen = '#10b981'; // emerald-500
    const incorrectRed = '#ef4444'; // rose-500

    // Core Metrics Calculations
    const totalParticipants = session.participants.length;
    const totalQuestions = session.quiz.questions.length;
    
    // Totals for average accuracy/scores
    let totalScoreAll = 0;
    let totalCorrectAnswers = 0;
    let totalAnswersSubmitted = 0;
    let totalResponseTimeMs = 0;
    let totalEarlyBonusAll = 0;
    let totalPenaltyAll = 0;

    session.participants.forEach((p) => {
      totalScoreAll += p.finalScore;
      p.answers.forEach((ans) => {
        totalAnswersSubmitted += 1;
        totalResponseTimeMs += ans.responseTimeMs;
        totalEarlyBonusAll += ans.earlyBonus || 0;
        totalPenaltyAll += ans.penalty || 0;
        if (ans.isCorrect) totalCorrectAnswers += 1;
      });
    });

    const avgScore = totalParticipants > 0 ? Math.round(totalScoreAll / totalParticipants) : 0;
    const avgAccuracy = totalAnswersSubmitted > 0 ? Math.round((totalCorrectAnswers / totalAnswersSubmitted) * 100) : 0;
    const avgResponseTimeSec = totalAnswersSubmitted > 0 ? Math.round((totalResponseTimeMs / totalAnswersSubmitted) / 100) / 10 : 0;
    const completionRate = (totalParticipants > 0 && totalQuestions > 0)
      ? Math.round((totalAnswersSubmitted / (totalParticipants * totalQuestions)) * 100)
      : 0;

    // =========================================================================
    // PAGE 1: COVER PAGE
    // =========================================================================
    // Background Accent
    doc.rect(0, 0, 15, 792).fill(secondaryColor);

    doc.fillColor(primaryColor);
    doc.fontSize(10).font('Helvetica-Bold').text('CLASSROOM QUIZ PLATFORM', 45, 60);
    doc.fontSize(28).font('Helvetica-Bold').text('Session Summary Report', 45, 80);
    
    doc.moveTo(45, 120).lineTo(560, 120).strokeColor(secondaryColor).lineWidth(2).stroke();

    // Quiz Info block
    doc.fillColor(textColor);
    doc.fontSize(18).font('Helvetica-Bold').text(session.quiz.title, 45, 145);
    if (session.quiz.description) {
      doc.fontSize(11).font('Helvetica-Oblique').text(session.quiz.description, 45, 170, { width: 500 });
    }

    // Metadata Details
    const metadataY = 230;
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('SESSION DETAILS', 45, metadataY);
    doc.moveTo(45, 245).lineTo(250, 245).strokeColor(borderGrey).lineWidth(0.5).stroke();

    doc.fillColor(textColor);
    let detailsRow = metadataY + 25;
    const addDetailLine = (label: string, value: string) => {
      doc.font('Helvetica-Bold').text(label, 45, detailsRow);
      doc.font('Helvetica').text(value, 160, detailsRow);
      detailsRow += 20;
    };

    addDetailLine('Join Code:', session.joinCode);
    addDetailLine('Session Mode:', session.mode);
    addDetailLine('Quiz Run Date:', new Date(session.startedAt).toLocaleDateString() + ' at ' + new Date(session.startedAt).toLocaleTimeString());
    addDetailLine('Status:', session.status);
    if (session.endedAt) {
      const dur = Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60000);
      addDetailLine('Duration:', `${dur} minutes`);
    } else {
      addDetailLine('Duration:', 'Ongoing / N/A');
    }
    addDetailLine('Total Early Bonus:', `+${totalEarlyBonusAll} pts`);
    addDetailLine('Total Penalties:', `-${totalPenaltyAll} pts`);

    // KPI Cards Block (rendered on Cover page)
    const kpiY = 380;
    doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor).text('KEY PERFORMANCE INDICATORS (KPIs)', 45, kpiY);
    
    // Draw 4 Grid Cards
    const drawKpiCard = (x: number, y: number, w: number, h: number, title: string, val: string, sub: string) => {
      doc.roundedRect(x, y, w, h, 8).fillColor(lightGrey).fill();
      doc.roundedRect(x, y, w, h, 8).strokeColor(borderGrey).lineWidth(0.5).stroke();
      
      doc.fillColor(primaryColor);
      doc.fontSize(8).font('Helvetica-Bold').text(title.toUpperCase(), x + 10, y + 10);
      doc.fontSize(18).font('Helvetica-Bold').text(val, x + 10, y + 25);
      doc.fontSize(7).font('Helvetica').fillColor('#64748b').text(sub, x + 10, y + 48);
    };

    drawKpiCard(45, kpiY + 20, 115, 65, 'Participants', `${totalParticipants}`, 'Students joined');
    drawKpiCard(175, kpiY + 20, 115, 65, 'Completion Rate', `${completionRate}%`, 'Answers recorded');
    drawKpiCard(305, kpiY + 20, 115, 65, 'Avg Score', `${avgScore}`, 'Points per student');
    drawKpiCard(435, kpiY + 20, 115, 65, 'Avg Accuracy', `${avgAccuracy}%`, 'Correct answers');

    // Bottom Decorative footer
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text('Generated dynamically by Classroom Quiz Platform Host Administrator.', 45, 730);

    // =========================================================================
    // PAGE 2: FINAL LEADERBOARD
    // =========================================================================
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor).text('Final Leaderboard Standings', 45, 50);
    doc.moveTo(45, 70).lineTo(560, 70).strokeColor(secondaryColor).lineWidth(1.5).stroke();

    // Highlights top 3
    const top3Y = 85;
    doc.roundedRect(45, top3Y, 515, 60, 6).fillColor(lightGrey).fill();
    doc.roundedRect(45, top3Y, 515, 60, 6).strokeColor(borderGrey).lineWidth(0.5).stroke();
    
    doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('TOP PERFORMANCE PODIUM', 55, top3Y + 10);
    let topPodiumText = 'No completions registered yet.';
    if (session.participants.length > 0) {
      const p1 = session.participants[0];
      const p2 = session.participants[1];
      const p3 = session.participants[2];
      topPodiumText = `Champion: ${p1.displayName} (${p1.finalScore} pts)`;
      if (p2) topPodiumText += `   |   2nd Place: ${p2.displayName} (${p2.finalScore} pts)`;
      if (p3) topPodiumText += `   |   3rd Place: ${p3.displayName} (${p3.finalScore} pts)`;
    }
    doc.fontSize(11).font('Helvetica').fillColor(textColor).text(topPodiumText, 55, top3Y + 30);

    // Leaderboard Table Header
    let tableY = 165;
    doc.rect(45, tableY, 515, 20).fillColor(primaryColor).fill();
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
    doc.text('Rank', 55, tableY + 6);
    doc.text('Student Name', 100, tableY + 6);
    doc.text('Final Score', 250, tableY + 6);
    doc.text('Accuracy', 370, tableY + 6);
    doc.text('Average Speed', 470, tableY + 6);

    tableY += 20;

    session.participants.forEach((p, idx) => {
      // Check if tableY exceeds page limit (700)
      if (tableY > 700) {
        doc.addPage();
        tableY = 50;
        doc.fontSize(14).font('Helvetica-Bold').fillColor(primaryColor).text('Final Leaderboard Standings (Cont.)', 45, tableY);
        tableY += 25;
        
        doc.rect(45, tableY, 515, 20).fillColor(primaryColor).fill();
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
        doc.text('Rank', 55, tableY + 6);
        doc.text('Student Name', 100, tableY + 6);
        doc.text('Final Score', 250, tableY + 6);
        doc.text('Accuracy', 370, tableY + 6);
        doc.text('Average Speed', 470, tableY + 6);
        tableY += 20;
      }

      // Alternating row color
      const isAlt = idx % 2 === 1;
      doc.rect(45, tableY, 515, 22).fillColor(isAlt ? lightGrey : '#ffffff').fill();
      doc.rect(45, tableY, 515, 22).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

      const pCorrect = p.answers.filter(a => a.isCorrect).length;
      const pTotal = p.answers.length;
      const pAccuracy = pTotal > 0 ? Math.round((pCorrect / pTotal) * 100) : 0;
      const pSpeed = pTotal > 0 ? Math.round((p.answers.reduce((acc, a) => acc + a.responseTimeMs, 0) / pTotal) / 100) / 10 : 0;

      doc.fontSize(9).font('Helvetica-Bold').fillColor(textColor).text(`#${p.finalRank || idx + 1}`, 55, tableY + 7);
      doc.font('Helvetica-Bold').text(p.displayName, 100, tableY + 7);
      doc.font('Helvetica').text(`${p.finalScore} pts`, 250, tableY + 7);
      doc.text(`${pAccuracy}%`, 370, tableY + 7);
      doc.text(`${pSpeed}s`, 470, tableY + 7);

      tableY += 22;
    });

    // =========================================================================
    // PAGE 3: QUESTIONS BREAKDOWN
    // =========================================================================
    doc.addPage();
    doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor).text('Question-by-Question Analysis', 45, 50);
    doc.moveTo(45, 70).lineTo(560, 70).strokeColor(secondaryColor).lineWidth(1.5).stroke();

    let questionY = 85;

    session.quiz.questions.forEach((q) => {
      // Calculate dynamic block height
      doc.fontSize(10).font('Helvetica-Bold');
      const textHeight = doc.heightOfString(q.text, { width: 495 });
      
      let codeHeight = 0;
      if (q.codeSnippet) {
        doc.fontSize(8).font('Courier');
        codeHeight = doc.heightOfString(q.codeSnippet, { width: 485 }) + 16;
      }
      
      let explanationHeight = 0;
      if (q.explanation) {
        doc.fontSize(7).font('Helvetica-Oblique');
        explanationHeight = doc.heightOfString(`Explanation: ${q.explanation}`, { width: 495 }) + 8;
      }
      
      const blockHeight = 15 + textHeight + 10 + codeHeight + 45 + explanationHeight + 10;

      // If bottom of page is reached, add page
      if (questionY + blockHeight > 720) {
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor).text('Question-by-Question Analysis (Cont.)', 45, 50);
        doc.moveTo(45, 70).lineTo(560, 70).strokeColor(secondaryColor).lineWidth(1.5).stroke();
        questionY = 85;
      }

      // Border container for question
      doc.roundedRect(45, questionY, 515, blockHeight, 6).fillColor('#fafafa').fill();
      doc.roundedRect(45, questionY, 515, blockHeight, 6).strokeColor(borderGrey).lineWidth(0.5).stroke();

      // Q Number & Type
      doc.fillColor(secondaryColor);
      doc.fontSize(9).font('Helvetica-Bold').text(`QUESTION ${q.order} (${q.type.replace('_', ' ')}) — ${q.points} PTS`, 55, questionY + 10);

      // Question Text
      doc.fillColor(textColor);
      doc.fontSize(10).font('Helvetica-Bold').text(q.text, 55, questionY + 25, { width: 495 });

      let currentInnerY = questionY + 25 + textHeight + 10;

      // Render Code Snippet if present
      if (q.codeSnippet) {
        doc.roundedRect(55, currentInnerY, 495, codeHeight - 6, 4).fillColor('#eaeaea').fill();
        doc.roundedRect(55, currentInnerY, 495, codeHeight - 6, 4).strokeColor('#d0d0d0').lineWidth(0.5).stroke();
        
        doc.fillColor(textColor);
        doc.fontSize(8).font('Courier').text(q.codeSnippet, 60, currentInnerY + 5, { width: 485, lineGap: 1 });
        
        currentInnerY += codeHeight;
      }

      // Answers aggregates
      const answersForQ = session.participants.flatMap(p => p.answers).filter(a => a.questionId === q.id);
      const totalAnswers = answersForQ.length;
      const correctAnswers = answersForQ.filter(a => a.isCorrect).length;
      const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
      const avgSpeed = totalAnswers > 0 ? Math.round((answersForQ.reduce((acc, a) => acc + a.responseTimeMs, 0) / totalAnswers) / 100) / 10 : 0;

      // Stats block
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('ACCURACY', 55, currentInnerY);
      doc.fontSize(14).font('Helvetica-Bold').fillColor(accuracy >= 80 ? correctGreen : accuracy >= 50 ? '#d97706' : incorrectRed).text(`${accuracy}%`, 55, currentInnerY + 10);

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('AVG RESPONSE TIME', 160, currentInnerY);
      doc.fontSize(14).font('Helvetica-Bold').fillColor(textColor).text(`${avgSpeed}s`, 160, currentInnerY + 10);

      // Options breakdown
      let optionX = 300;
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('OPTION DISTRIBUTION', optionX, currentInnerY);
      
      let optTextRows = currentInnerY + 12;
      q.options.forEach((opt, oIdx) => {
        if (oIdx >= 3) return; // limit to first 3 options to fit layout block
        const optCount = answersForQ.filter(a => a.selectedOptionId === opt.id).length;
        doc.fontSize(8).font(opt.isCorrect ? 'Helvetica-Bold' : 'Helvetica').fillColor(opt.isCorrect ? correctGreen : textColor);
        doc.text(`${opt.text.substring(0, 24)}${opt.text.length > 24 ? '...' : ''} (${optCount} selected)`, optionX, optTextRows);
        optTextRows += 11;
      });

      currentInnerY += 45;

      // Explanation
      if (q.explanation) {
        doc.fontSize(7).font('Helvetica-Oblique').fillColor('#64748b').text(`Explanation: ${q.explanation}`, 55, currentInnerY, { width: 495 });
      }

      questionY += blockHeight + 12;
    });

    // =========================================================================
    // PAGE 4+: INDIVIDUAL STUDENT REPORTS
    // =========================================================================
    session.participants.forEach((p) => {
      // Skip students who didn't submit any answers to prevent blank pages at the end
      if (p.answers.length === 0) return;

      doc.addPage();
      doc.fontSize(16).font('Helvetica-Bold').fillColor(primaryColor).text(`Student Performance: ${p.displayName}`, 45, 50);
      doc.moveTo(45, 70).lineTo(560, 70).strokeColor(secondaryColor).lineWidth(1.5).stroke();

      // Student Scorecard Banner
      const cardY = 85;
      doc.roundedRect(45, cardY, 515, 60, 6).fillColor(lightGrey).fill();
      doc.roundedRect(45, cardY, 515, 60, 6).strokeColor(borderGrey).lineWidth(0.5).stroke();

      const pCorrect = p.answers.filter(a => a.isCorrect).length;
      const pTotal = p.answers.length;
      const pAccuracy = pTotal > 0 ? Math.round((pCorrect / pTotal) * 100) : 0;
      const pSpeed = pTotal > 0 ? Math.round((p.answers.reduce((acc, a) => acc + a.responseTimeMs, 0) / pTotal) / 100) / 10 : 0;

      const drawDrilldownStat = (x: number, label: string, val: string) => {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text(label.toUpperCase(), x, cardY + 15);
        doc.fontSize(18).font('Helvetica-Bold').fillColor(primaryColor).text(val, x, cardY + 28);
      };

      drawDrilldownStat(65, 'Final Score', `${p.finalScore} pts`);
      drawDrilldownStat(185, 'Final Rank', `#${p.finalRank || 'N/A'}`);
      drawDrilldownStat(305, 'Accuracy', `${pAccuracy}%`);
      drawDrilldownStat(425, 'Avg Speed', `${pSpeed}s`);

      // Answers Matrix
      let studentTableY = 165;
      doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor).text('Response Timeline Details', 45, studentTableY);
      studentTableY += 15;

      doc.rect(45, studentTableY, 515, 18).fillColor(primaryColor).fill();
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
      doc.text('Q#', 55, studentTableY + 5);
      doc.text('Question Text', 85, studentTableY + 5);
      doc.text('Your Selected Option', 280, studentTableY + 5);
      doc.text('Result', 430, studentTableY + 5);
      doc.text('Speed', 485, studentTableY + 5);
      doc.text('Points', 525, studentTableY + 5);

      studentTableY += 18;

      // Sort timeline by question order
      const sortedAnswers = [...p.answers].sort((a, b) => a.question.order - b.question.order);

      sortedAnswers.forEach((ans) => {
        // Check if studentTableY exceeds page limit (700)
        if (studentTableY > 700) {
          doc.addPage();
          studentTableY = 50;
          doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor).text(`Student Performance: ${p.displayName} (Cont.)`, 45, studentTableY);
          studentTableY += 20;

          doc.rect(45, studentTableY, 515, 18).fillColor(primaryColor).fill();
          doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
          doc.text('Q#', 55, studentTableY + 5);
          doc.text('Question Text', 85, studentTableY + 5);
          doc.text('Your Selected Option', 280, studentTableY + 5);
          doc.text('Result', 430, studentTableY + 5);
          doc.text('Speed', 485, studentTableY + 5);
          doc.text('Points', 525, studentTableY + 5);
          studentTableY += 18;
        }

        doc.rect(45, studentTableY, 515, 24).fillColor(lightGrey).fill();
        doc.rect(45, studentTableY, 515, 24).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

        doc.fontSize(8).font('Helvetica-Bold').fillColor(textColor).text(`Q${ans.question.order}`, 55, studentTableY + 8);
        doc.font('Helvetica').text(ans.question.text.substring(0, 36) + (ans.question.text.length > 36 ? '...' : ''), 85, studentTableY + 8);
        const optionText = ans.selectedOption ? ans.selectedOption.text : 'Unanswered';
        doc.text(optionText.substring(0, 28) + (optionText.length > 28 ? '...' : ''), 280, studentTableY + 8);
        
        doc.font('Helvetica-Bold').fillColor(ans.isCorrect ? correctGreen : incorrectRed).text(ans.isCorrect ? 'Correct' : 'Incorrect', 430, studentTableY + 8);
        doc.font('Helvetica').fillColor(textColor).text(`${Math.round(ans.responseTimeMs / 100) / 10}s`, 485, studentTableY + 8);
        doc.font('Helvetica-Bold').fillColor(secondaryColor).text(`${ans.pointsAwarded}`, 525, studentTableY + 4);
        
        if (ans.earlyBonus > 0) {
          doc.fontSize(6).font('Helvetica-Bold').fillColor(correctGreen).text(`+${ans.earlyBonus} bonus`, 525, studentTableY + 14);
        } else if (ans.penalty > 0) {
          doc.fontSize(6).font('Helvetica-Bold').fillColor(incorrectRed).text(`-${ans.penalty} penalty`, 525, studentTableY + 14);
        }

        studentTableY += 24;
      });

      // Slowest responses list
      const sortedSlowest = [...p.answers].sort((a, b) => b.responseTimeMs - a.responseTimeMs).slice(0, 3);
      if (sortedSlowest.length > 0) {
        if (studentTableY > 650) {
          doc.addPage();
          studentTableY = 50;
          doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor).text(`Student Performance: ${p.displayName} (Cont.)`, 45, studentTableY);
          studentTableY += 25;
        }

        studentTableY += 20;
        doc.fontSize(10).font('Helvetica-Bold').fillColor(primaryColor).text('Focus Areas (Slowest Responses)', 45, studentTableY);
        studentTableY += 15;

        sortedSlowest.forEach((ans, idx) => {
          const qText = `${idx + 1}. Q${ans.question.order}: "${ans.question.text}"`;
          const textHeight = doc.heightOfString(qText, { width: 515 });

          if (studentTableY + textHeight + 25 > 740) {
            doc.addPage();
            studentTableY = 50;
            doc.fontSize(11).font('Helvetica-Bold').fillColor(primaryColor).text(`Student Performance: ${p.displayName} (Cont.)`, 45, studentTableY);
            studentTableY += 25;
          }

          doc.fontSize(8).font('Helvetica-Bold').fillColor(textColor).text(qText, 45, studentTableY, { width: 515 });
          studentTableY += textHeight + 2;

          const metaText = `   Response Time: ${Math.round(ans.responseTimeMs / 100) / 10}s   |   Status: ${ans.isCorrect ? 'Correct' : 'Incorrect'}`;
          doc.fontSize(8).font('Helvetica').fillColor('#64748b').text(metaText, 45, studentTableY);
          studentTableY += 16;
        });
      }
    });

    // =========================================================================
    // GLOBAL HEADER & FOOTER GENERATION (Dynamic Page Numbers)
    // =========================================================================
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);
      
      // Footer
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8');
      doc.text(`Classroom Quiz summary report (Join Code: ${session.joinCode})`, 45, 755);
      doc.text(`Page ${i + 1} of ${pages.count}`, 500, 755, { align: 'right' });
    }

    doc.end();
  } catch (error) {
    next(error);
  }
};
