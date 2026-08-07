-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL DEFAULT 'deepseek',
    "baseUrl" TEXT NOT NULL DEFAULT 'https://api.deepseek.com',
    "model" TEXT NOT NULL DEFAULT 'deepseek-v4-flash',
    "apiKey" TEXT,
    "promptTokensTotal" INTEGER NOT NULL DEFAULT 0,
    "completionTokensTotal" INTEGER NOT NULL DEFAULT 0,
    "totalTokensTotal" INTEGER NOT NULL DEFAULT 0,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "lastPromptTokens" INTEGER NOT NULL DEFAULT 0,
    "lastCompletionTokens" INTEGER NOT NULL DEFAULT 0,
    "lastTotalTokens" INTEGER NOT NULL DEFAULT 0,
    "usageUpdatedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "worktime_imports" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileName" TEXT NOT NULL,
    "records" JSONB NOT NULL,
    "columnMap" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "importId" INTEGER,
    "content" JSONB NOT NULL,
    "aiUsed" BOOLEAN NOT NULL DEFAULT false,
    "aiError" TEXT,
    "chatMessages" JSONB,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sys_params" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "excelRowNo" INTEGER NOT NULL,
    "configName" TEXT,
    "configKey" TEXT,
    "module" TEXT,
    "comment" TEXT,
    "backendService" TEXT,
    "raw" JSONB NOT NULL,
    "imagePaths" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sys_param_ai_state" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scope" TEXT NOT NULL DEFAULT 'all',
    "selectedIds" JSONB,
    "analysisMarkdown" TEXT,
    "chatMessages" JSONB,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "note" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
