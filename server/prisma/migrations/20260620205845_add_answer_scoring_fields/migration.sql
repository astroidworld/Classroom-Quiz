-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "earlyBonus" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "penalty" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "selectedOptionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "settings" JSONB DEFAULT '{}';
