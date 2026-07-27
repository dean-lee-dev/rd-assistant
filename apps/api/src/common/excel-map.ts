/** Excel 表头别名 → 标准字段（精确匹配优先，见 buildColumnMap） */
export const WORKTIME_ALIASES: Record<string, string[]> = {
  registrant: ['登记人', '填报人', '姓名'],
  workDate: ['工作日期', '日期', '工时日期'],
  hours: ['工作时长(h)', '工作时长', '工时', '时长'],
  approvedHours: ['已审批工时'],
  approvalStatus: ['审批状态'],
  summary: ['工时单据摘要', '工时明细流程', '单据摘要'],
  category1: ['工时一级分类', '一级分类'],
  category2: ['工时二级分类', '二级分类'],
  workHourId: ['工时id', '工时ID', '工时Id'],
  /** 描述优先于备注 */
  description: ['描述'],
  remark: ['备注', '工作内容', '说明'],
  projectCode: ['交付项目编号', '项目编号', '项目号'],
  /** 任务标识优先，避免误匹配工时id */
  taskId: ['任务标识', '任务号', '任务编号', '需求号', '需求编号'],
  taskType: ['任务类型'],
  requirementName: ['需求名称'],
  taskTitle: ['任务名称'],
};

export const SYS_PARAM_ALIASES: Record<string, string[]> = {
  configName: ['config_name', '配置名称', '名称', '参数名称'],
  configKey: ['config_key', '配置键', '配置key', 'key'],
  module: ['模块', 'module'],
  comment: ['注释', '备注', '说明', 'comment'],
  configPerson: ['配置人员', '负责人'],
  frontendUsage: ['前端使用情况'],
  frontendPage: ['前端页面'],
  backendApiComment: ['后端接口注释', '接口注释'],
  backendService: ['后端服务', '服务'],
  deleted: ['是否已经删除', '是否删除'],
  background: ['是否背景', '是否背景色'],
};

export function normalizeHeader(h: unknown): string {
  return String(h ?? '')
    .replace(/\s+/g, '')
    .replace(/\n/g, '')
    .trim();
}

export function buildColumnMap(
  headers: string[],
  aliases: Record<string, string[]>,
): Record<string, number> {
  const map: Record<string, number> = {};
  const normalized = headers.map(normalizeHeader);
  const used = new Set<number>();

  for (const [field, names] of Object.entries(aliases)) {
    // 1) 精确匹配
    let idx = normalized.findIndex(
      (h, i) => !used.has(i) && names.some((n) => normalizeHeader(n) === h),
    );
    // 2) 表头包含别名（别名至少 2 字，避免误伤）
    if (idx < 0) {
      idx = normalized.findIndex(
        (h, i) =>
          !used.has(i) &&
          names.some((n) => {
            const a = normalizeHeader(n);
            return a.length >= 2 && h === a;
          }),
      );
    }
    if (idx >= 0) {
      map[field] = idx;
      used.add(idx);
    }
  }
  return map;
}

export function cellToString(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof v === 'object' && v !== null && 'text' in (v as object)) {
    return String((v as { text: unknown }).text ?? '');
  }
  if (typeof v === 'object' && v !== null && 'result' in (v as object)) {
    return cellToString((v as { result: unknown }).result);
  }
  if (typeof v === 'number' && Number.isFinite(v)) {
    // 任务标识等可能是数字
    return String(Math.trunc(v) === v ? Math.trunc(v) : v);
  }
  return String(v).trim();
}

export function isDefectType(taskType: string): boolean {
  const t = taskType.toLowerCase();
  return (
    t.includes('缺陷') ||
    t.includes('defect') ||
    t.includes('bug') ||
    t.includes('现场问题')
  );
}

/** 把描述拆成明细列表，并去掉开头的编号（如 1. / 1、 / （1）） */
export function parseDescriptionDetails(desc: string): string[] {
  const text = String(desc || '').trim();
  if (!text) return [];

  const byLine = text
    .split(/\r?\n/)
    .map((l) => stripLeadingNumber(l))
    .filter(Boolean);
  if (byLine.length > 1) return byLine;

  const numbered = text
    .split(/(?=\d+\s*[\.．、\)）]\s*)/)
    .map((l) => stripLeadingNumber(l))
    .filter(Boolean);
  if (numbered.length > 1) return numbered;

  const single = stripLeadingNumber(text);
  return single ? [single] : [];
}

/** 反复去掉行首编号，避免出现「1. 1. xxx」 */
export function stripLeadingNumber(line: string): string {
  let s = String(line || '').trim();
  // 最多剥 5 层，防止异常死循环
  for (let i = 0; i < 5; i++) {
    const next = s
      .replace(/^\d+\s*[\.．、]\s*/, '')
      .replace(/^[（(]\s*\d+\s*[)）]\s*/, '')
      .replace(/^[①②③④⑤⑥⑦⑧⑨⑩]\s*/, '')
      .trim();
    if (next === s) break;
    s = next;
  }
  return s;
}
