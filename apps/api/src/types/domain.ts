/** 对话轮次（周报 / 配置洞察共用形态） */
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

export interface SysParamChatTurn {
  role: 'user' | 'assistant';
  content: string;
  at: string;
}
