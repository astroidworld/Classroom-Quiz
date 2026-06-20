-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "currentQuestionId" TEXT,
ADD COLUMN     "currentQuestionStartedAt" TIMESTAMP(3),
ADD COLUMN     "isCompleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "homeworkEnd" TIMESTAMP(3),
ADD COLUMN     "homeworkStart" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_currentQuestionId_fkey" FOREIGN KEY ("currentQuestionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;
