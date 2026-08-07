import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', unique: true })
  username!: string;

  @Column({ type: 'varchar' })
  passwordHash!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('ai_settings')
export class AiSetting {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', default: 'deepseek' })
  provider!: string;

  @Column({ type: 'varchar', default: 'https://api.deepseek.com' })
  baseUrl!: string;

  @Column({ type: 'varchar', default: 'deepseek-v4-flash' })
  model!: string;

  @Column({ type: 'text', nullable: true })
  apiKey!: string | null;

  /** 累计 prompt tokens */
  @Column({ type: 'integer', default: 0 })
  promptTokensTotal!: number;

  /** 累计 completion tokens */
  @Column({ type: 'integer', default: 0 })
  completionTokensTotal!: number;

  /** 累计 total tokens */
  @Column({ type: 'integer', default: 0 })
  totalTokensTotal!: number;

  /** 累计请求次数 */
  @Column({ type: 'integer', default: 0 })
  requestCount!: number;

  @Column({ type: 'integer', default: 0 })
  lastPromptTokens!: number;

  @Column({ type: 'integer', default: 0 })
  lastCompletionTokens!: number;

  @Column({ type: 'integer', default: 0 })
  lastTotalTokens!: number;

  @Column({ type: 'datetime', nullable: true })
  usageUpdatedAt!: Date | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}

@Entity('worktime_imports')
export class WorktimeImport {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  fileName!: string;

  @Column({ type: 'simple-json' })
  records!: Record<string, unknown>[];

  @Column({ type: 'simple-json', nullable: true })
  columnMap!: Record<string, string> | null;

  @Column({ type: 'integer', default: 0 })
  rowCount!: number;

  @CreateDateColumn()
  createdAt!: Date;
}

@Entity('weekly_reports')
export class WeeklyReport {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer', nullable: true })
  importId!: number | null;

  @Column({ type: 'simple-json' })
  content!: WeeklyReportContent;

  @Column({ type: 'boolean', default: false })
  aiUsed!: boolean;

  @Column({ type: 'text', nullable: true })
  aiError!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  chatMessages!: ChatTurn[] | null;

  @UpdateDateColumn()
  updatedAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  at?: string;
}

export interface WeeklyReportTaskItem {
  taskId: string;
  title: string;
  details: string[];
  isDefect: boolean;
}

export interface WeeklyReportContent {
  completedTasks: WeeklyReportTaskItem[];
  defects: WeeklyReportTaskItem[];
  nextWeekPlan: WeeklyReportTaskItem[];
  /** 本周完成工作 - 原始富文本 */
  completedWorkHtml: string;
  /** 本周完成工作 - AI 润色版 */
  completedWorkHtmlAi: string;
  /** 下周工作计划 - 原始富文本 */
  nextWeekPlanHtml: string;
  /** 下周工作计划 - AI 润色版 */
  nextWeekPlanHtmlAi: string;
  goalRate: string;
  summary: string;
  nextWeekIdeas: string;
  needsHelp: string;
}

@Entity('sys_params')
export class SysParam {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'integer' })
  excelRowNo!: number;

  @Column({ type: 'text', nullable: true })
  configName!: string | null;

  @Column({ type: 'text', nullable: true })
  configKey!: string | null;

  @Column({ type: 'text', nullable: true })
  module!: string | null;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;

  @Column({ type: 'text', nullable: true })
  backendService!: string | null;

  @Column({ type: 'simple-json' })
  raw!: Record<string, unknown>;

  @Column({ type: 'simple-json', nullable: true })
  imagePaths!: string[] | null;

  @CreateDateColumn()
  createdAt!: Date;
}

export interface SysParamChatTurn {
  role: 'user' | 'assistant';
  content: string;
  at: string;
}

/** 配置洞察 AI 分析会话（单行持久化） */
@Entity('sys_param_ai_state')
export class SysParamAiState {
  @PrimaryGeneratedColumn()
  id!: number;

  /** all | selected */
  @Column({ type: 'varchar', default: 'all' })
  scope!: string;

  @Column({ type: 'simple-json', nullable: true })
  selectedIds!: number[] | null;

  @Column({ type: 'text', nullable: true })
  analysisMarkdown!: string | null;

  @Column({ type: 'simple-json', nullable: true })
  chatMessages!: SysParamChatTurn[] | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}

/** 备忘录 */
@Entity('note')
export class Note {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  content!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}