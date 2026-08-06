-- CreateTable
CREATE TABLE "GeneratedPrompt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userInput" TEXT NOT NULL,
    "clarifyingQuestions" TEXT,
    "clarifyingAnswers" TEXT,
    "finalPrompt" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
