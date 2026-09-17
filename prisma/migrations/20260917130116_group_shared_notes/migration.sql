-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StudyGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "about" TEXT NOT NULL DEFAULT '',
    "subjectId" TEXT,
    "subjectName" TEXT NOT NULL DEFAULT '',
    "ownerId" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "sharedNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudyGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyGroup_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StudyGroup" ("about", "createdAt", "id", "inviteCode", "name", "ownerId", "subjectId", "subjectName") SELECT "about", "createdAt", "id", "inviteCode", "name", "ownerId", "subjectId", "subjectName" FROM "StudyGroup";
DROP TABLE "StudyGroup";
ALTER TABLE "new_StudyGroup" RENAME TO "StudyGroup";
CREATE UNIQUE INDEX "StudyGroup_inviteCode_key" ON "StudyGroup"("inviteCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
