import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { BarChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import type { ECharts, EChartsOption } from 'echarts';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { API_BASE, UPLOADS_BASE } from '../../core/api/api-base';
import { MdViewComponent } from '../../shared/md-view.component';
import { SseClient } from '../../shared/sse-client.service';

echarts.use([
  BarChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

/** 配置洞察页主 Tab：参数表格 / 汇总图表 / AI 分析 */
type TabKey = 'table' | 'summary' | 'ai';

/** AI 分析范围：全量参数或仅选中行 */
type AnalyzeScope = 'all' | 'selected';

/** 参数列表行（表格摘要字段） */
interface ParamItem {
  /** 参数主键 */
  id: number;
  /** Excel 物理行号 */
  excelRowNo: number;
  /** 配置名称 */
  configName: string | null;
  /** 配置 Key */
  configKey: string | null;
  /** 所属模块 */
  module: string | null;
  /** 后端服务 */
  backendService: string | null;
  /** 是否含内嵌图片 */
  hasImage: boolean;
}

/** 按模块聚合的统计项（汇总图表用） */
interface ModuleStat {
  /** 模块名 */
  module: string;
  /** 该模块下参数条数 */
  count: number;
}

/** 参数详情（列表字段 + 备注/原始列/图片） */
interface Detail extends ParamItem {
  /** 备注说明 */
  comment: string | null;
  /** Excel 原始列键值 */
  raw: Record<string, unknown>;
  /** 内嵌图访问路径列表 */
  imageUrls: string[];
}

/** 右侧 AI 对话单轮消息 */
interface ChatTurn {
  /** 发言角色 */
  role: 'user' | 'assistant';
  /** Markdown 文本内容 */
  content: string;
  /** 可选时间戳 */
  at?: string;
}

/**
 * 配置洞察页 — 参数表格/汇总图表/AI 分析（全量或选中）+ 右侧流式对话。
 *
 * 能力概览：
 * - 表格 Tab：导入 Excel、按关键词/模块过滤、查看详情
 * - 汇总 Tab：模块柱状图与饼图，点击可跳转模块过滤
 * - AI Tab：全量或勾选行 SSE 流式分析，右侧快捷问与自由对话
 */
@Component({
  selector: 'app-sys-params',
  imports: [
    CommonModule,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzRadioModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    MdViewComponent,
  ],
  templateUrl: './sys-params.component.html',
  styleUrl: './sys-params.component.scss',
})
export class SysParamsComponent implements OnDestroy {
  /** 汇总柱状图容器 */
  @ViewChild('barChart') barChartRef?: ElementRef<HTMLDivElement>;
  /** 汇总饼图容器 */
  @ViewChild('pieChart') pieChartRef?: ElementRef<HTMLDivElement>;
  /** 右侧对话列表容器（用于自动滚到底） */
  @ViewChild('chatList') chatListRef?: ElementRef<HTMLDivElement>;

  private readonly http = inject(HttpClient);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sse = inject(SseClient);
  /** 柱状图 ECharts 实例 */
  private barChart?: ECharts;
  /** 饼图 ECharts 实例 */
  private pieChart?: ECharts;
  /** 是否需要在下一帧滚动对话列表 */
  private needScrollChat = false;
  /** 窗口 resize 时同步图表尺寸 */
  private resizeHandler = () => {
    this.barChart?.resize();
    this.pieChart?.resize();
  };

  /** 上传文件/图片的静态资源前缀 */
  readonly uploadsBase = UPLOADS_BASE;
  /** 饼图展示 Top N，其余归入「其他」 */
  readonly pieTopN = 8;
  /** Tab 顺序，与 tabIndex 对应 */
  readonly tabKeys: TabKey[] = ['table', 'summary', 'ai'];
  /** AI 对话区快捷提问文案 */
  readonly quickQuestions = [
    '这份分析里最值得优先处理的风险是什么？',
    '有哪些空 Key / 重复 Key 需要清理？',
    '按模块给我一份治理建议清单',
  ];
  /** 详情弹窗 body 样式（限高可滚动） */
  readonly detailModalBodyStyle: Record<string, string> = {
    maxHeight: 'calc(100vh - 160px)',
    overflowY: 'auto',
    paddingTop: '12px',
  };
  /** 选参弹窗 body 样式（随分页高度同步） */
  pickModalBodyStyle: Record<string, string> = {
    height: '430px',
    paddingTop: '8px',
    overflow: 'hidden',
  };
  /** 选参表格纵向滚动配置 */
  pickTableScroll: { y: string } = { y: '280px' };
  /** 选参表格可选每页条数 */
  readonly pickPageSizeOptions = [10, 20, 50, 100];
  /** 选参表格当前每页条数 */
  pickPageSize = 10;

  /** 当前主 Tab 下标 */
  tabIndex = 0;
  /** 主参数表格每页条数 */
  pageSize = 20;
  /** 当前过滤后的参数列表 */
  items: ParamItem[] = [];
  /** 模块统计（过滤后） */
  modules: ModuleStat[] = [];
  /** 表格关键词搜索 */
  query = '';
  /** 当前模块过滤（null 表示不过滤） */
  module: string | null = null;
  /** 列表加载中 */
  loading = false;
  /** Excel 导入中 */
  uploading = false;
  /** AI 分析流式进行中 */
  analyzing = false;
  /** 详情弹窗是否可见 */
  modalVisible = false;
  /** 选参弹窗是否可见 */
  pickModalVisible = false;
  /** 详情加载中 */
  detailLoading = false;
  /** 当前详情数据 */
  detail: Detail | null = null;

  /** 当前选择的分析范围 */
  analyzeScope: AnalyzeScope = 'all';
  /** 选参弹窗内的搜索关键词 */
  aiQuery = '';
  /** 已确认选中的参数 id */
  selectedIds = new Set<number>();
  /** 已确认选中数量（模板绑定用） */
  selectedCount = 0;
  /** 选参弹窗内草稿选中 id */
  draftSelectedIds = new Set<number>();
  /** 草稿选中数量（模板绑定用） */
  draftSelectedCount = 0;
  /** 最近一次 AI 分析 Markdown 结果 */
  analysis = '';
  /** 最近一次分析实际使用的范围 */
  lastScope: AnalyzeScope = 'all';
  /** 最近一次选中分析时的条数 */
  lastSelectedCount = 0;
  /** 右侧对话历史 */
  chatMessages: ChatTurn[] = [];
  /** 对话输入框内容 */
  chatInput = '';
  /** 对话流式进行中 */
  chatting = false;

  constructor() {
    window.addEventListener('resize', this.resizeHandler);
    this.loadTable();
    this.loadAiState();
  }

  /** 各模块参数条数合计 */
  get totalCount(): number {
    return this.modules.reduce((sum, m) => sum + m.count, 0);
  }

  /** 柱状图容器高度（随模块数伸缩） */
  get barHeight(): number {
    return Math.max(320, this.modules.length * 28 + 60);
  }

  /** 选参弹窗内按 aiQuery 过滤后的列表 */
  get filteredPickItems(): ParamItem[] {
    const s = this.aiQuery.trim().toLowerCase();
    if (!s) return this.items;
    return this.items.filter((i) => {
      return (
        (i.configName || '').toLowerCase().includes(s) ||
        (i.configKey || '').toLowerCase().includes(s) ||
        (i.module || '').toLowerCase().includes(s) ||
        String(i.excelRowNo).includes(s)
      );
    });
  }

  /** 详情 raw 字段展平为可展示条目（跳过空值） */
  get rawEntries(): { key: string; value: string; abnormal: boolean }[] {
    try {
      const raw = this.detail?.raw;
      if (!raw || typeof raw !== 'object') {
        return [{ key: 'raw', value: '原始字段缺失或格式异常', abnormal: true }];
      }
      return Object.entries(raw)
        .map(([key, value]) => {
          const formatted = this.formatCell(value);
          return {
            key: key || '(空字段名)',
            value: formatted.text,
            abnormal: formatted.abnormal,
            empty: this.isEmptyCell(value),
          };
        })
        .filter((entry) => !entry.empty)
        .map(({ key, value, abnormal }) => ({ key, value, abnormal }));
    } catch {
      return [{ key: 'raw', value: '原始字段解析失败', abnormal: true }];
    }
  }

  /** 详情图片 URL 列表（容错过滤非法项） */
  get imageUrls(): string[] {
    try {
      const urls = this.detail?.imageUrls;
      return Array.isArray(urls) ? urls.filter((u) => typeof u === 'string' && u) : [];
    } catch {
      return [];
    }
  }

  /** 卸载时移除 resize 监听并销毁图表 */
  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.disposeCharts();
  }

  /**
   * Tab 切换回调：进入汇总时渲染图表，进入 AI 时刷新会话状态。
   * @param index 新 Tab 下标
   */
  onTabIndexChange(index: number): void {
    const key = this.tabKeys[index];
    if (key === 'summary') {
      setTimeout(() => this.renderCharts(), 50);
    }
    if (key === 'ai') {
      this.loadAiState();
    }
  }

  /** 按当前 query/module 拉取参数列表与模块统计 */
  loadTable(): void {
    this.loading = true;
    const params: Record<string, string> = {};
    if (this.query.trim()) params['q'] = this.query.trim();
    if (this.module) params['module'] = this.module;
    this.http
      .get<{ items: ParamItem[]; modules: ModuleStat[] }>(`${API_BASE}/sys-params`, { params })
      .subscribe({
        next: (data) => {
          this.items = data.items;
          this.modules = data.modules;
          this.loading = false;
          if (this.tabKeys[this.tabIndex] === 'summary') {
            setTimeout(() => this.renderCharts(), 0);
          }
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  /** 从服务端恢复 AI 分析范围、结果 Markdown 与对话历史 */
  loadAiState(): void {
    this.http
      .get<{
        scope: AnalyzeScope;
        selectedIds: number[];
        analysisMarkdown: string;
        chatMessages: ChatTurn[];
      }>(`${API_BASE}/sys-params/ai-state`)
      .subscribe({
        next: (data) => {
          this.analysis = data.analysisMarkdown || '';
          this.lastScope = data.scope === 'selected' ? 'selected' : 'all';
          this.lastSelectedCount = (data.selectedIds || []).length;
          this.chatMessages = data.chatMessages || [];
          if (data.selectedIds?.length) {
            this.setSelectedIds(data.selectedIds);
            this.analyzeScope = 'selected';
          }
          this.needScrollChat = true;
          this.cdr.markForCheck();
          setTimeout(() => this.scrollChat(), 0);
        },
      });
  }

  /** 清除模块过滤并重新加载表格 */
  clearModuleFilter(): void {
    this.module = null;
    this.loadTable();
  }

  /**
   * 分析范围切换：切到「选中」且尚无选中项时打开选参弹窗。
   * @param scope 新的分析范围
   */
  onAnalyzeScopeChange(scope: AnalyzeScope): void {
    if (scope === 'selected' && !this.selectedCount) {
      this.openPickModal();
    }
  }

  /** 打开选参弹窗，草稿同步当前已选 */
  openPickModal(): void {
    this.setDraftSelectedIds([...this.selectedIds]);
    this.aiQuery = '';
    this.syncPickTableScroll();
    this.pickModalVisible = true;
  }

  /**
   * 选参表格每页条数变更，并同步弹窗/表格高度。
   * @param size 新的每页条数
   */
  onPickPageSizeChange(size: number): void {
    this.pickPageSize = size;
    this.syncPickTableScroll();
  }

  /** 按每页条数收紧表格可视高度，减少底部空白 */
  private syncPickTableScroll(): void {
    const rowH = 39;
    const rows = Math.min(this.pickPageSize, 12);
    const y = Math.max(200, rows * rowH);
    this.pickTableScroll = { y: `${y}px` };
    this.pickModalBodyStyle = {
      height: `${y + 140}px`,
      paddingTop: '8px',
      overflow: 'hidden',
    };
  }

  /** 关闭选参弹窗（不提交草稿） */
  closePickModal(): void {
    this.pickModalVisible = false;
  }

  /** 确认选参：草稿写入正式选中并关闭弹窗 */
  confirmPickModal(): void {
    this.setSelectedIds([...this.draftSelectedIds]);
    this.pickModalVisible = false;
    if (!this.selectedCount) {
      this.message.info('尚未选择参数');
    }
  }

  /**
   * 判断草稿中是否已选中某 id。
   * @param id 参数 id
   */
  isDraftSelected(id: number): boolean {
    return this.draftSelectedIds.has(id);
  }

  /** 行点击：切换选中 */
  toggleDraftSelect(id: number): void {
    const next = new Set(this.draftSelectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.setDraftSelectedIds([...next]);
  }

  /** 勾选框：以原生 checked 为准，避免与行点击重复翻转 */
  onDraftCheckChange(id: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const next = new Set(this.draftSelectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    this.setDraftSelectedIds([...next]);
  }

  /** 将当前过滤结果全部加入草稿选中 */
  selectAllFilteredDraft(): void {
    const next = new Set(this.draftSelectedIds);
    for (const item of this.filteredPickItems) next.add(item.id);
    this.setDraftSelectedIds([...next]);
  }

  /** 清空选参弹窗草稿选中 */
  clearDraftSelection(): void {
    this.setDraftSelectedIds([]);
  }

  /** 清空已确认的分析选中 */
  clearSelection(): void {
    this.setSelectedIds([]);
  }

  /** 写入正式选中 id 并同步 selectedCount */
  private setSelectedIds(ids: number[]): void {
    const uniq = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))];
    this.selectedIds = new Set(uniq);
    this.selectedCount = this.selectedIds.size;
  }

  /** 写入草稿选中 id 并同步 draftSelectedCount */
  private setDraftSelectedIds(ids: number[]): void {
    const uniq = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))];
    this.draftSelectedIds = new Set(uniq);
    this.draftSelectedCount = this.draftSelectedIds.size;
  }

  /**
   * 选择 Excel 文件后全量导入参数。
   * @param event input[type=file] change 事件
   */
  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    this.uploading = true;
    this.http.post<{ imported: number }>(`${API_BASE}/sys-params/import`, body).subscribe({
      next: (data) => {
        this.uploading = false;
        this.message.success(`已全量导入 ${data.imported} 条参数`);
        this.clearSelection();
        this.loadTable();
      },
      error: (error: { error?: { message?: string } }) => {
        this.uploading = false;
        this.message.error(error.error?.message || '导入失败');
      },
    });
  }

  /**
   * 打开参数详情弹窗并拉取详情。
   * @param id 参数主键
   */
  openDetail(id: number): void {
    this.detail = null;
    this.detailLoading = true;
    this.modalVisible = true;
    this.cdr.markForCheck();
    this.http.get<Detail>(`${API_BASE}/sys-params/${id}`).subscribe({
      next: (detail) => {
        this.detail = this.normalizeDetail(detail);
        this.detailLoading = false;
        this.cdr.detectChanges();
      },
      error: (error: { error?: { message?: string } }) => {
        const msg = error.error?.message || '加载详情失败，请稍后重试';
        this.detail = {
          id,
          excelRowNo: 0,
          configName: null,
          configKey: null,
          module: null,
          backendService: null,
          hasImage: false,
          comment: msg,
          raw: { 错误说明: msg },
          imageUrls: [],
        };
        this.detailLoading = false;
        this.cdr.detectChanges();
        this.message.warning('部分详情加载失败，已在弹框中展示错误信息');
      },
    });
  }

  /** 关闭详情弹窗并清空详情状态 */
  closeDetail(): void {
    this.modalVisible = false;
    this.detail = null;
    this.detailLoading = false;
  }

  /**
   * 将单元格值格式化为展示文本。
   * @param value 任意单元格值
   */
  displayCell(value: unknown): string {
    return this.formatCell(value).text;
  }

  /**
   * 图片加载失败时替换为异常提示节点。
   * @param event img error 事件
   */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img?.parentElement) return;
    const tip = document.createElement('div');
    tip.className = 'abnormal';
    tip.textContent = '图片加载失败';
    img.replaceWith(tip);
  }

  /** 按当前范围发起 SSE 流式 AI 分析（全量或选中 ids） */
  analyze(): void {
    if (this.analyzeScope === 'selected' && !this.selectedCount) {
      this.message.warning('请先勾选要分析的参数');
      return;
    }
    this.analyzing = true;
    this.analysis = '';
    const body =
      this.analyzeScope === 'selected' ? { ids: [...this.selectedIds] } : { ids: [] };

    this.sse.postSse(`${API_BASE}/sys-params/analyze/stream`, body).subscribe({
      next: (ev) => {
        if (ev.type === 'meta') {
          this.lastScope = ev.scope === 'selected' ? 'selected' : 'all';
          this.lastSelectedCount = ev.count || (ev.selectedIds || []).length;
        }
        if (ev.type === 'delta' && ev.content) {
          this.analysis += ev.content;
          this.cdr.detectChanges();
        }
        if (ev.type === 'done' && typeof ev.markdown === 'string') {
          this.analysis = ev.markdown;
        }
      },
      error: (error: Error) => {
        this.analyzing = false;
        this.cdr.detectChanges();
        this.message.error(error.message || 'AI 分析失败');
      },
      complete: () => {
        this.analyzing = false;
        this.cdr.detectChanges();
        this.message.success(
          this.lastScope === 'selected'
            ? `已完成 ${this.lastSelectedCount} 条选中参数分析`
            : '已完成整体分析',
        );
      },
    });
  }

  /** 发送右侧对话（SSE 流式追加助手回复） */
  sendChat(): void {
    if (!this.chatInput.trim() || this.chatting) return;
    const message = this.chatInput.trim();
    this.chatInput = '';
    this.chatting = true;
    this.chatMessages = [
      ...this.chatMessages,
      { role: 'user', content: message },
      { role: 'assistant', content: '' },
    ];
    this.needScrollChat = true;
    setTimeout(() => this.scrollChat(), 0);

    const assistantIndex = this.chatMessages.length - 1;
    this.sse.postSse(`${API_BASE}/sys-params/chat/stream`, { message }).subscribe({
      next: (ev) => {
        if (ev.type === 'delta' && ev.content) {
          const cur = this.chatMessages[assistantIndex];
          if (cur) {
            this.chatMessages[assistantIndex] = {
              ...cur,
              content: cur.content + ev.content,
            };
            this.chatMessages = [...this.chatMessages];
            this.needScrollChat = true;
            this.cdr.detectChanges();
            this.scrollChat();
          }
        }
        if (ev.type === 'done' && ev.chatMessages) {
          this.chatMessages = ev.chatMessages as ChatTurn[];
        }
      },
      error: (error: Error) => {
        this.chatting = false;
        this.chatInput = message;
        // 去掉空的助手气泡与刚发的用户消息（若未完成）
        if (
          this.chatMessages.length >= 2 &&
          this.chatMessages[this.chatMessages.length - 1]?.role === 'assistant' &&
          !this.chatMessages[this.chatMessages.length - 1]?.content
        ) {
          this.chatMessages = this.chatMessages.slice(0, -2);
        }
        this.cdr.detectChanges();
        this.message.error(error.message || '对话失败');
      },
      complete: () => {
        this.chatting = false;
        this.needScrollChat = true;
        this.cdr.detectChanges();
        setTimeout(() => this.scrollChat(), 0);
      },
    });
  }

  /**
   * 使用快捷文案填入输入框并立即发送。
   * @param q 快捷问题文案
   */
  askQuick(q: string): void {
    this.chatInput = q;
    this.sendChat();
  }

  /**
   * 对话输入 Enter 发送（Shift+Enter 换行）。
   * @param event 键盘事件
   */
  onChatEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey) return;
    e.preventDefault();
    this.sendChat();
  }

  /** 请求服务端清空对话历史 */
  clearChat(): void {
    this.http.post<{ chatMessages: ChatTurn[] }>(`${API_BASE}/sys-params/chat/clear`, {}).subscribe({
      next: () => {
        this.chatMessages = [];
        this.message.success('已清空对话');
      },
      error: (error: { error?: { message?: string } }) => {
        this.message.error(error.error?.message || '清空失败');
      },
    });
  }

  /** 将对话列表滚至底部 */
  private scrollChat(): void {
    if (!this.needScrollChat) return;
    const el = this.chatListRef?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
      this.needScrollChat = false;
    }
  }

  /** 规范化详情中的 imageUrls / raw，避免空值异常 */
  private normalizeDetail(detail: Detail): Detail {
    return {
      ...detail,
      imageUrls: Array.isArray(detail?.imageUrls) ? detail.imageUrls : [],
      raw: detail?.raw && typeof detail.raw === 'object' ? detail.raw : {},
    };
  }

  /** 格式化单元格展示文本，异常时标记 abnormal */
  private formatCell(value: unknown): { text: string; abnormal: boolean } {
    try {
      if (value == null || value === '') return { text: '-', abnormal: false };
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return { text: String(value), abnormal: false };
      }
      return { text: JSON.stringify(value), abnormal: false };
    } catch {
      return { text: '[该单元格数据异常，无法展示]', abnormal: true };
    }
  }

  /** 判断单元格是否视为空（不展示） */
  private isEmptyCell(value: unknown): boolean {
    if (value == null) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') {
      try {
        return Object.keys(value as object).length === 0;
      } catch {
        return false;
      }
    }
    return false;
  }

  /** 点击图表模块名后切换到表格并按该模块过滤 */
  private openModuleTable(name: string): void {
    if (!name || name.startsWith('其他')) return;
    this.module = name;
    this.query = '';
    this.tabIndex = 0;
    this.loadTable();
    this.message.success(`已打开模块表格：${name}`);
  }

  /** 根据 modules 渲染/更新柱状图与饼图 */
  private renderCharts(): void {
    if (!this.modules.length) {
      this.disposeCharts();
      return;
    }
    const barEl = this.barChartRef?.nativeElement;
    const pieEl = this.pieChartRef?.nativeElement;
    if (!barEl || !pieEl) return;

    if (this.barChart && this.barChart.getDom() !== barEl) {
      this.barChart.dispose();
      this.barChart = undefined;
    }
    if (this.pieChart && this.pieChart.getDom() !== pieEl) {
      this.pieChart.dispose();
      this.pieChart = undefined;
    }

    if (!this.barChart) this.barChart = echarts.init(barEl);
    if (!this.pieChart) this.pieChart = echarts.init(pieEl);

    const sorted = [...this.modules].sort((a, b) => a.count - b.count);
    const names = sorted.map((m) => m.module);
    const values = sorted.map((m) => m.count);

    const barOption: EChartsOption = {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 12, right: 28, top: 16, bottom: 8, containLabel: true },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: {
        type: 'category',
        data: names,
        axisLabel: { width: 140, overflow: 'truncate' },
      },
      series: [
        {
          type: 'bar',
          data: values,
          barMaxWidth: 18,
          itemStyle: { color: '#1677ff', borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right' },
        },
      ],
    };

    const top = [...this.modules].sort((a, b) => b.count - a.count);
    const head = top.slice(0, this.pieTopN);
    const rest = top.slice(this.pieTopN);
    const pieData = head.map((m) => ({ name: m.module, value: m.count }));
    const otherSum = rest.reduce((s, m) => s + m.count, 0);
    if (otherSum > 0) pieData.push({ name: `其他（${rest.length}项）`, value: otherSum });

    const pieOption: EChartsOption = {
      tooltip: { trigger: 'item', formatter: '{b}<br/>{c}（{d}%）' },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 0,
        top: 'middle',
        textStyle: { width: 110, overflow: 'truncate' },
      },
      series: [
        {
          type: 'pie',
          radius: ['36%', '62%'],
          center: ['38%', '50%'],
          data: pieData,
          avoidLabelOverlap: true,
          label: { formatter: '{d}%' },
          emphasis: {
            itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.15)' },
          },
        },
      ],
    };

    this.barChart.setOption(barOption, true);
    this.pieChart.setOption(pieOption, true);
    this.barChart.resize();
    this.pieChart.resize();

    this.barChart.off('click');
    this.pieChart.off('click');
    this.barChart.on('click', (params) => this.openModuleTable(String(params.name || '')));
    this.pieChart.on('click', (params) => this.openModuleTable(String(params.name || '')));
  }

  /** 销毁并清空 ECharts 实例 */
  private disposeCharts(): void {
    this.barChart?.dispose();
    this.pieChart?.dispose();
    this.barChart = undefined;
    this.pieChart = undefined;
  }
}
