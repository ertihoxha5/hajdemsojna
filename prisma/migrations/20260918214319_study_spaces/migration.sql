-- CreateTable
CREATE TABLE "StudySpaceSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "spaceId" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'focus',
    "currentRound" INTEGER NOT NULL DEFAULT 1,
    "totalRounds" INTEGER NOT NULL DEFAULT 5,
    "studyMinutes" INTEGER NOT NULL DEFAULT 50,
    "breakMinutes" INTEGER NOT NULL DEFAULT 10,
    "phaseStartedAt" DATETIME,
    "phaseElapsed" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" DATETIME,
    CONSTRAINT "StudySpaceSession_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "StudyGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GroupMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isAI" BOOLEAN NOT NULL DEFAULT false,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "payload" TEXT,
    "replyToId" TEXT,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupMessage_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GroupMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GroupMessage" ("authorName", "createdAt", "groupId", "id", "isAI", "kind", "payload", "text", "userId") SELECT "authorName", "createdAt", "groupId", "id", "isAI", "kind", "payload", "text", "userId" FROM "GroupMessage";
DROP TABLE "GroupMessage";
ALTER TABLE "new_GroupMessage" RENAME TO "GroupMessage";
CREATE INDEX "GroupMessage_groupId_createdAt_idx" ON "GroupMessage"("groupId", "createdAt");
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
    "privacy" TEXT NOT NULL DEFAULT 'private',
    "environment" TEXT NOT NULL DEFAULT 'biblioteka',
    "ambient" TEXT NOT NULL DEFAULT 'none',
    "syncAmbient" BOOLEAN NOT NULL DEFAULT false,
    "studyMinutes" INTEGER NOT NULL DEFAULT 50,
    "breakMinutes" INTEGER NOT NULL DEFAULT 10,
    "roundCount" INTEGER NOT NULL DEFAULT 5,
    "maxMembers" INTEGER NOT NULL DEFAULT 8,
    "aiSupervisor" BOOLEAN NOT NULL DEFAULT true,
    "rules" TEXT NOT NULL DEFAULT '',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "StudyGroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyGroup_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StudyGroup" ("about", "createdAt", "id", "inviteCode", "name", "ownerId", "sharedNotes", "subjectId", "subjectName") SELECT "about", "createdAt", "id", "inviteCode", "name", "ownerId", "sharedNotes", "subjectId", "subjectName" FROM "StudyGroup";
DROP TABLE "StudyGroup";
ALTER TABLE "new_StudyGroup" RENAME TO "StudyGroup";
CREATE UNIQUE INDEX "StudyGroup_inviteCode_key" ON "StudyGroup"("inviteCode");
CREATE INDEX "StudyGroup_privacy_createdAt_idx" ON "StudyGroup"("privacy", "createdAt");
CREATE TABLE "new_StudyGroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "state" TEXT NOT NULL DEFAULT 'offline',
    "lastSeen" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avatarX" INTEGER NOT NULL DEFAULT 6,
    "avatarY" INTEGER NOT NULL DEFAULT 5,
    "seatId" TEXT,
    "activity" TEXT NOT NULL DEFAULT 'disconnected',
    "lastActiveAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "studySubject" TEXT NOT NULL DEFAULT '',
    "studyTopic" TEXT NOT NULL DEFAULT '',
    "studyGoal" TEXT NOT NULL DEFAULT '',
    "goalDone" BOOLEAN NOT NULL DEFAULT false,
    "focusSeconds" INTEGER NOT NULL DEFAULT 0,
    "focusPoints" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StudyGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudyGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_StudyGroupMember" ("groupId", "id", "joinedAt", "lastSeen", "role", "state", "userId") SELECT "groupId", "id", "joinedAt", "lastSeen", "role", "state", "userId" FROM "StudyGroupMember";
DROP TABLE "StudyGroupMember";
ALTER TABLE "new_StudyGroupMember" RENAME TO "StudyGroupMember";
CREATE INDEX "StudyGroupMember_userId_idx" ON "StudyGroupMember"("userId");
CREATE UNIQUE INDEX "StudyGroupMember_groupId_userId_key" ON "StudyGroupMember"("groupId", "userId");
CREATE TABLE "new_UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "learnerType" TEXT NOT NULL DEFAULT 'universitet',
    "institution" TEXT NOT NULL DEFAULT '',
    "year" TEXT NOT NULL DEFAULT '',
    "avatarTone" INTEGER NOT NULL DEFAULT 0,
    "avatar" TEXT NOT NULL DEFAULT '',
    "streak" INTEGER NOT NULL DEFAULT 0,
    "onboardedAt" DATETIME,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserProfile" ("avatarTone", "id", "institution", "learnerType", "onboardedAt", "streak", "userId", "year") SELECT "avatarTone", "id", "institution", "learnerType", "onboardedAt", "streak", "userId", "year" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "StudySpaceSession_spaceId_startedAt_idx" ON "StudySpaceSession"("spaceId", "startedAt");
