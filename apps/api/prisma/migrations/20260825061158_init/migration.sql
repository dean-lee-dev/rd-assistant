-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_settings" (
    "id" SERIAL NOT NULL,
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
    "usageUpdatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worktime_imports" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "records" JSONB NOT NULL,
    "columnMap" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "worktime_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_reports" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER,
    "content" JSONB NOT NULL,
    "aiUsed" BOOLEAN NOT NULL DEFAULT false,
    "aiError" TEXT,
    "chatMessages" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_params" (
    "id" SERIAL NOT NULL,
    "excelRowNo" INTEGER NOT NULL,
    "configName" TEXT,
    "configKey" TEXT,
    "module" TEXT,
    "comment" TEXT,
    "backendService" TEXT,
    "raw" JSONB NOT NULL,
    "imagePaths" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sys_params_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sys_param_ai_state" (
    "id" SERIAL NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'all',
    "selectedIds" JSONB,
    "analysisMarkdown" TEXT,
    "chatMessages" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sys_param_ai_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "note" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" SERIAL NOT NULL,
    "originalName" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER NOT NULL,
    "relativePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
