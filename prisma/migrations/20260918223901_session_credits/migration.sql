-- AlterTable
ALTER TABLE "StudySpaceSession" ADD COLUMN "creditedAt" DATETIME;

-- CreateTable
CREATE TABLE "SessionCredit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rounds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SessionCredit_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySpaceSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "SessionCredit_sessionId_idx" ON "SessionCredit"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionCredit_sessionId_userId_key" ON "SessionCredit"("sessionId", "userId");
