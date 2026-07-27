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
import { AuthService } from '../../core/auth/auth.service';
import { MdViewComponent } from '../../shared/md-view.component';
import { postSse } from '../../shared/sse-client';

echarts.use([
  BarChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

type TabKey = 'table' | 'summary' | 'ai';
type AnalyzeScope = 'all' | 'selected';

interface ParamItem {
  id: number;
  excelRowNo: number;
  configName: string | null;
  configKey: string | null;
  module: string | null;
  backendService: string | null;
  hasImage: boolean;
}
interface ModuleStat {
  module: string;
  count: number;
}
interface Detail extends ParamItem {
  comment: string | null;
  raw: Record<string, unknown>;
  imageUrls: string[];
}
interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  at?: string;
}

@Component({
  selector: 'app-sys-params',
  standalone: true,
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
  template: `
    <nz-card nzTitle="配置洞察" [nzExtra]="actions">
      <ng-template #actions>
        <input #fileInput type="file" accept=".xlsx,.xls" hidden (change)="onFileChange($event)" />
        <button nz-button (click)="fileInput.click()" [nzLoading]="uploading">上传 Excel（全量覆盖）</button>
      </ng-template>

      <nz-tabset [(nzSelectedIndex)]="tabIndex" (nzSelectedIndexChange)="onTabIndexChange($event)">
        <nz-tab nzTitle="表格模式">
          <div class="filters">
            <input
              nz-input
              [(ngModel)]="query"
              (ngModelChange)="loadTable()"
              placeholder="搜索名称、Key、备注或任意字段"
            />
            <nz-select
              [(ngModel)]="module"
              (ngModelChange)="loadTable()"
              nzAllowClear
              nzPlaceHolder="全部模块"
            >
              @for (item of modules; track item.module) {
                <nz-option
                  [nzValue]="item.module"
                  [nzLabel]="item.module + '（' + item.count + '）'"
                ></nz-option>
              }
            </nz-select>
          </div>
          @if (module) {
            <div class="filter-tip">
              当前模块：<strong>{{ module }}</strong>
              <a (click)="clearModuleFilter()">清除筛选</a>
            </div>
          }
          <nz-table
            #table
            [nzData]="items"
            [nzLoading]="loading"
            [nzFrontPagination]="true"
            [nzShowPagination]="true"
            [nzShowSizeChanger]="true"
            [nzPageSizeOptions]="[10, 20, 50, 100]"
            [nzPageSize]="pageSize"
            [nzTotal]="items.length"
            nzPaginationPosition="bottom"
          >
            <thead>
              <tr>
                <th>Excel 行号</th>
                <th>配置名称</th>
                <th>配置 Key</th>
                <th>模块</th>
                <th>后端服务</th>
                <th>图片</th>
                <th nzWidth="88px">详情</th>
              </tr>
            </thead>
            <tbody>
              @for (item of table.data; track item.id) {
                <tr>
                  <td>{{ item.excelRowNo }}</td>
                  <td>{{ item.configName || '-' }}</td>
                  <td>{{ item.configKey || '-' }}</td>
                  <td>{{ item.module || '-' }}</td>
                  <td>{{ item.backendService || '-' }}</td>
                  <td>{{ item.hasImage ? '是' : '否' }}</td>
                  <td>
                    <a (click)="openDetail(item.id); $event.preventDefault()">详情</a>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab nzTitle="汇总模式">
          <div class="summary">
            <div class="summary-head">
              <h3>模块分布汇总</h3>
              <span class="muted">共 {{ totalCount }} 条 · 点击柱状图/饼图可打开对应模块表格</span>
            </div>
            @if (modules.length) {
              <div class="charts">
                <div class="chart-panel">
                  <div class="chart-title">柱状图</div>
                  <div #barChart class="chart" [style.height.px]="barHeight"></div>
                </div>
                <div class="chart-panel">
                  <div class="chart-title">饼图（Top {{ pieTopN }} + 其他）</div>
                  <div #pieChart class="chart pie"></div>
                </div>
              </div>
            } @else {
              <nz-empty nzNotFoundContent="暂无数据，请先上传 Excel"></nz-empty>
            }
          </div>
        </nz-tab>

        <nz-tab nzTitle="AI 分析">
          <div class="ai-pane">
            <div class="ai-toolbar">
              <nz-radio-group
                [(ngModel)]="analyzeScope"
                (ngModelChange)="onAnalyzeScopeChange($event)"
                nzButtonStyle="solid"
                nzSize="small"
              >
                <label nz-radio-button nzValue="all">分析全部</label>
                <label nz-radio-button nzValue="selected">分析选中</label>
              </nz-radio-group>

              @if (analyzeScope === 'selected') {
                <button nz-button nzSize="small" (click)="openPickModal()">选择参数</button>
                <span class="selected-count">已选 <strong>{{ selectedCount }}</strong> 条</span>
                @if (selectedCount) {
                  <a class="clear-link" (click)="clearSelection()">清空</a>
                }
              }

              <button
                nz-button
                nzType="primary"
                (click)="analyze()"
                [nzLoading]="analyzing"
                [disabled]="analyzeScope === 'selected' && !selectedCount"
              >
                {{ analyzeScope === 'all' ? '开始整体分析' : '分析选中（' + selectedCount + '）' }}
              </button>
              <span class="muted toolbar-hint">
                {{
                  analyzeScope === 'all'
                    ? '基于全部参数，逐行含完整原始字段'
                    : '在弹框中勾选参数后分析，每行含完整原始字段'
                }}
              </span>
            </div>

            <div class="split">
              <nz-card class="left panel-card" nzTitle="分析结果">
                <div class="panel-body">
                  @if (analysis || analyzing) {
                    <div class="scope-tip muted">
                      @if (analyzing) {
                        正在生成分析…
                      } @else if (lastScope === 'selected') {
                        基于选中 {{ lastSelectedCount }} 条参数
                      } @else {
                        基于全部参数
                      }
                    </div>
                    <div class="analysis-box">
                      <app-md-view [content]="analysis" [streaming]="analyzing"></app-md-view>
                    </div>
                  } @else {
                    <nz-empty nzNotFoundContent="尚未生成分析，选择范围后点击上方按钮开始"></nz-empty>
                  }
                </div>
              </nz-card>

              <nz-card class="right panel-card" nzTitle="ai小助手对话" [nzExtra]="chatExtra">
                <ng-template #chatExtra>
                  <button nz-button nzSize="small" (click)="clearChat()" [disabled]="!chatMessages.length">
                    清空对话
                  </button>
                </ng-template>
                <div class="chat-panel">
                  <p class="muted chat-hint">可基于左侧分析结果继续追问、对比或讨论配置风险。</p>
                  <div class="chat-quick">
                    @for (q of quickQuestions; track q) {
                      <nz-tag class="quick" (click)="askQuick(q)">{{ q }}</nz-tag>
                    }
                  </div>
                  <div class="chat-list" #chatList>
                    @if (!chatMessages.length && !chatting) {
                      <div class="muted empty-chat">暂无对话，在下方输入后开始沟通。</div>
                    }
                    @for (msg of chatMessages; track $index) {
                      <div
                        class="bubble"
                        [class.user]="msg.role === 'user'"
                        [class.assistant]="msg.role === 'assistant'"
                      >
                        <div class="role">{{ msg.role === 'user' ? '我' : 'ai小助手' }}</div>
                        @if (msg.role === 'assistant') {
                          <div class="content md">
                            <app-md-view
                              [content]="msg.content"
                              [streaming]="chatting && $index === chatMessages.length - 1"
                            ></app-md-view>
                          </div>
                        } @else {
                          <div class="content pre">{{ msg.content }}</div>
                        }
                      </div>
                    }
                  </div>
                  <div class="chat-input">
                    <textarea
                      nz-input
                      rows="2"
                      [(ngModel)]="chatInput"
                      placeholder="就配置参数继续提问…"
                      (keydown.enter)="onChatEnter($event)"
                    ></textarea>
                    <button
                      nz-button
                      nzType="primary"
                      (click)="sendChat()"
                      [nzLoading]="chatting"
                      [disabled]="!chatInput.trim()"
                    >
                      发送
                    </button>
                  </div>
                </div>
              </nz-card>
            </div>
          </div>
        </nz-tab>
      </nz-tabset>
    </nz-card>

    <nz-modal
      [(nzVisible)]="pickModalVisible"
      nzTitle="选择要分析的参数"
      [nzWidth]="650"
      nzCentered
      nzWrapClassName="sys-pick-modal-wrap"
      [nzStyle]="{ width: '650px', maxWidth: '650px' }"
      [nzBodyStyle]="pickModalBodyStyle"
      (nzOnCancel)="closePickModal()"
      (nzOnOk)="confirmPickModal()"
      [nzOkText]="'确定（' + draftSelectedCount + '）'"
    >
      <ng-container *nzModalContent>
        <div class="pick-modal-body">
          <div class="select-actions">
            <input
              nz-input
              [(ngModel)]="aiQuery"
              placeholder="筛选待选参数（名称 / Key / 模块）"
              class="ai-filter"
            />
            <button nz-button nzSize="small" (click)="selectAllFilteredDraft()">全选当前筛选</button>
            <button
              nz-button
              nzSize="small"
              (click)="clearDraftSelection()"
              [disabled]="!draftSelectedCount"
            >
              清空已选
            </button>
            <span class="muted">已选 {{ draftSelectedCount }} 条</span>
          </div>
          <div class="pick-table-wrap">
            <nz-table
              #pickTable
              [nzData]="filteredPickItems"
              [nzFrontPagination]="true"
              [nzShowPagination]="true"
              [(nzPageSize)]="pickPageSize"
              [nzPageSizeOptions]="pickPageSizeOptions"
              [nzShowSizeChanger]="true"
              [nzScroll]="pickTableScroll"
              nzSize="small"
              nzTableLayout="fixed"
              nzPaginationPosition="bottom"
              (nzPageSizeChange)="onPickPageSizeChange($event)"
            >
              <thead>
                <tr>
                  <th nzWidth="40px"></th>
                  <th nzWidth="56px">行号</th>
                  <th nzWidth="120px">配置名称</th>
                  <th nzWidth="140px">配置 Key</th>
                  <th>模块</th>
                </tr>
              </thead>
              <tbody>
                @for (item of pickTable.data; track item.id) {
                  <tr (click)="toggleDraftSelect(item.id)" class="pick-row">
                    <td (click)="$event.stopPropagation()">
                      <label class="check">
                        <input
                          type="checkbox"
                          [checked]="isDraftSelected(item.id)"
                          (change)="onDraftCheckChange(item.id, $event)"
                        />
                      </label>
                    </td>
                    <td>{{ item.excelRowNo }}</td>
                    <td class="ellipsis" [title]="item.configName || ''">{{ item.configName || '-' }}</td>
                    <td class="ellipsis" [title]="displayCell(item.configKey)">{{ displayCell(item.configKey) }}</td>
                    <td class="ellipsis" [title]="item.module || ''">{{ item.module || '-' }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </div>
        </div>
      </ng-container>
    </nz-modal>

    <nz-modal
      [(nzVisible)]="modalVisible"
      nzTitle="参数详情"
      [nzWidth]="900"
      nzCentered
      nzWrapClassName="sys-detail-modal-wrap"
      [nzFooter]="null"
      [nzBodyStyle]="detailModalBodyStyle"
      (nzOnCancel)="closeDetail()"
    >
      <ng-container *nzModalContent>
        <div class="detail-body">
          @if (detailLoading) {
            <p class="muted">加载中...</p>
          } @else if (detail) {
            <div class="detail-meta">
              <p><strong>Excel 行号：</strong>{{ displayCell(detail.excelRowNo) }}</p>
              <p><strong>配置名称：</strong>{{ displayCell(detail.configName) }}</p>
              <p><strong>配置 Key：</strong>{{ displayCell(detail.configKey) }}</p>
              <p><strong>模块：</strong>{{ displayCell(detail.module) }}</p>
              <p><strong>后端服务：</strong>{{ displayCell(detail.backendService) }}</p>
              <p><strong>注释：</strong>{{ displayCell(detail.comment) }}</p>
            </div>
            <h4>原始字段</h4>
            <nz-table [nzData]="rawEntries" [nzShowPagination]="false" nzSize="small">
              <thead>
                <tr>
                  <th nzWidth="180px">字段</th>
                  <th>值</th>
                </tr>
              </thead>
              <tbody>
                @for (entry of rawEntries; track entry.key) {
                  <tr>
                    <td>{{ entry.key }}</td>
                    <td class="wrap" [class.abnormal]="entry.abnormal">{{ entry.value }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            @if (imageUrls.length) {
              <h4>关联图片</h4>
              <div class="images">
                @for (url of imageUrls; track url) {
                  <div class="image-item">
                    <img [src]="uploadsBase + url" alt="参数截图" (error)="onImageError($event)" />
                  </div>
                }
              </div>
            }
          } @else {
            <p class="muted">暂无详情数据</p>
          }
        </div>
      </ng-container>
    </nz-modal>
  `,
  styles: [
    `
      .filters {
        display: grid;
        grid-template-columns: 1fr 260px;
        gap: 12px;
        margin-bottom: 12px;
      }
      .filter-tip {
        margin-bottom: 12px;
        color: #595959;
        font-size: 13px;
      }
      .filter-tip a {
        margin-left: 12px;
        cursor: pointer;
      }
      .summary {
        padding: 8px 0 4px;
      }
      .summary-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 12px;
      }
      .summary-head h3 {
        margin: 0;
        font-size: 15px;
      }
      .muted {
        color: #8c8c8c;
        font-size: 13px;
      }
      .charts {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 16px;
      }
      .chart-panel {
        min-width: 0;
        background: #fafafa;
        border: 1px solid #f0f0f0;
        border-radius: 8px;
        padding: 8px 4px 4px;
      }
      .chart-title {
        padding: 0 12px 4px;
        font-size: 13px;
        color: #595959;
      }
      .chart {
        width: 100%;
        min-height: 280px;
      }
      .chart.pie {
        height: 420px;
      }
      .detail-meta p {
        margin: 0 0 8px;
      }
      .wrap {
        word-break: break-all;
      }
      .abnormal {
        color: #cf1322;
      }
      .image-item {
        min-height: 40px;
      }
      .ai-pane {
        display: flex;
        flex-direction: column;
        height: calc(100vh - 220px);
        min-height: 420px;
        overflow: hidden;
      }
      .ai-toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 12px;
        flex-shrink: 0;
      }
      .toolbar-hint {
        flex: 1;
        min-width: 160px;
      }
      .selected-count {
        font-size: 13px;
        color: #595959;
      }
      .clear-link {
        font-size: 13px;
        cursor: pointer;
      }
      .select-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 12px;
        flex-shrink: 0;
      }
      .pick-modal-body {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        max-width: 100%;
        overflow: hidden;
      }
      .pick-table-wrap {
        flex: 1;
        min-height: 0;
        max-width: 100%;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .pick-table-wrap ::ng-deep .ant-spin-nested-loading,
      .pick-table-wrap ::ng-deep .ant-spin-container,
      .pick-table-wrap ::ng-deep .ant-table-wrapper {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .pick-table-wrap ::ng-deep .ant-table-pagination {
        margin: 8px 0 0 !important;
        flex-shrink: 0;
      }
      .pick-table-wrap ::ng-deep .ant-table-placeholder {
        height: 260px;
      }
      .pick-table-wrap ::ng-deep .ant-empty {
        margin-top: 60px;
      }
      .pick-table-wrap ::ng-deep .ant-table {
        table-layout: fixed;
      }
      .ellipsis {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-width: 0;
      }
      .ai-filter {
        max-width: 220px;
        flex: 1;
      }
      .pick-row {
        cursor: pointer;
      }
      .check {
        cursor: pointer;
      }
      .split {
        flex: 1;
        min-height: 0;
        display: grid;
        grid-template-columns: 1.1fr 0.9fr;
        gap: 16px;
        align-items: stretch;
        overflow: hidden;
      }
      .left,
      .right {
        min-width: 0;
        min-height: 0;
        height: 100%;
      }
      .panel-card {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      :host ::ng-deep .panel-card > .ant-card-body {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        padding-top: 12px;
      }
      .panel-body {
        flex: 1;
        min-height: 0;
        overflow: auto;
      }
      .scope-tip {
        margin-bottom: 8px;
      }
      .analysis-box {
        background: #fafafa;
        border: 1px solid #f0f0f0;
        border-radius: 8px;
        padding: 14px 16px;
        min-height: 80px;
      }
      .analysis-pre {
        white-space: pre-wrap;
        font-family: inherit;
        background: #fafafa;
        border: 1px solid #f0f0f0;
        border-radius: 8px;
        padding: 16px;
        margin: 0;
      }
      .chat-panel {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .chat-hint {
        margin-bottom: 8px;
        flex-shrink: 0;
      }
      .chat-quick {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 10px;
        flex-shrink: 0;
      }
      .quick {
        cursor: pointer;
      }
      .chat-list {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 12px;
        background: #fafafa;
        border: 1px solid #f0f0f0;
        border-radius: 8px;
        margin-bottom: 10px;
      }
      .empty-chat {
        text-align: center;
        padding: 40px 0;
      }
      .bubble {
        margin-bottom: 12px;
        max-width: 92%;
      }
      .bubble.user {
        margin-left: auto;
      }
      .bubble .role {
        font-size: 12px;
        color: #8c8c8c;
        margin-bottom: 4px;
      }
      .bubble .content {
        padding: 10px 12px;
        border-radius: 10px;
        background: #fff;
        border: 1px solid #f0f0f0;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      }
      .bubble .content.md {
        background: #fff;
      }
      .bubble.user .content {
        background: #e6f4ff;
        border-color: #91caff;
      }
      .pre {
        white-space: pre-wrap;
      }
      .chat-input {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 10px;
        align-items: end;
        flex-shrink: 0;
      }
      .images {
        display: grid;
        gap: 12px;
      }
      .images img {
        display: block;
        max-width: 100%;
        max-height: 480px;
        object-fit: contain;
        border: 1px solid #eee;
        background: #fafafa;
      }
      @media (max-width: 1100px) {
        .charts {
          grid-template-columns: 1fr;
        }
        .ai-pane {
          height: auto;
          min-height: 0;
          overflow: visible;
        }
        .split {
          grid-template-columns: 1fr;
          overflow: visible;
        }
        .panel-card,
        .left,
        .right {
          height: auto;
        }
        :host ::ng-deep .panel-card > .ant-card-body {
          overflow: visible;
        }
        .panel-body {
          max-height: 420px;
        }
        .chat-list {
          height: 280px;
          flex: none;
        }
      }
    `,
  ],
})
export class SysParamsComponent implements OnDestroy {
  @ViewChild('barChart') barChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('pieChart') pieChartRef?: ElementRef<HTMLDivElement>;
  @ViewChild('chatList') chatListRef?: ElementRef<HTMLDivElement>;

  private readonly http = inject(HttpClient);
  private readonly message = inject(NzMessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly auth = inject(AuthService);
  private barChart?: ECharts;
  private pieChart?: ECharts;
  private needScrollChat = false;
  private resizeHandler = () => {
    this.barChart?.resize();
    this.pieChart?.resize();
  };

  readonly uploadsBase = UPLOADS_BASE;
  readonly pieTopN = 8;
  readonly tabKeys: TabKey[] = ['table', 'summary', 'ai'];
  readonly quickQuestions = [
    '这份分析里最值得优先处理的风险是什么？',
    '有哪些空 Key / 重复 Key 需要清理？',
    '按模块给我一份治理建议清单',
  ];
  readonly detailModalBodyStyle: Record<string, string> = {
    maxHeight: 'calc(100vh - 160px)',
    overflowY: 'auto',
    paddingTop: '12px',
  };
  pickModalBodyStyle: Record<string, string> = {
    height: '430px',
    paddingTop: '8px',
    overflow: 'hidden',
  };
  pickTableScroll: { y: string } = { y: '280px' };
  readonly pickPageSizeOptions = [10, 20, 50, 100];
  pickPageSize = 10;

  tabIndex = 0;
  pageSize = 20;
  items: ParamItem[] = [];
  modules: ModuleStat[] = [];
  query = '';
  module: string | null = null;
  loading = false;
  uploading = false;
  analyzing = false;
  modalVisible = false;
  pickModalVisible = false;
  detailLoading = false;
  detail: Detail | null = null;

  analyzeScope: AnalyzeScope = 'all';
  aiQuery = '';
  selectedIds = new Set<number>();
  selectedCount = 0;
  draftSelectedIds = new Set<number>();
  draftSelectedCount = 0;
  analysis = '';
  lastScope: AnalyzeScope = 'all';
  lastSelectedCount = 0;
  chatMessages: ChatTurn[] = [];
  chatInput = '';
  chatting = false;

  constructor() {
    window.addEventListener('resize', this.resizeHandler);
    this.loadTable();
    this.loadAiState();
  }

  get totalCount(): number {
    return this.modules.reduce((sum, m) => sum + m.count, 0);
  }

  get barHeight(): number {
    return Math.max(320, this.modules.length * 28 + 60);
  }

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

  get imageUrls(): string[] {
    try {
      const urls = this.detail?.imageUrls;
      return Array.isArray(urls) ? urls.filter((u) => typeof u === 'string' && u) : [];
    } catch {
      return [];
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.resizeHandler);
    this.disposeCharts();
  }

  onTabIndexChange(index: number): void {
    const key = this.tabKeys[index];
    if (key === 'summary') {
      setTimeout(() => this.renderCharts(), 50);
    }
    if (key === 'ai') {
      this.loadAiState();
    }
  }

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

  clearModuleFilter(): void {
    this.module = null;
    this.loadTable();
  }

  onAnalyzeScopeChange(scope: AnalyzeScope): void {
    if (scope === 'selected' && !this.selectedCount) {
      this.openPickModal();
    }
  }

  openPickModal(): void {
    this.setDraftSelectedIds([...this.selectedIds]);
    this.aiQuery = '';
    this.syncPickTableScroll();
    this.pickModalVisible = true;
  }

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

  closePickModal(): void {
    this.pickModalVisible = false;
  }

  confirmPickModal(): void {
    this.setSelectedIds([...this.draftSelectedIds]);
    this.pickModalVisible = false;
    if (!this.selectedCount) {
      this.message.info('尚未选择参数');
    }
  }

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

  selectAllFilteredDraft(): void {
    const next = new Set(this.draftSelectedIds);
    for (const item of this.filteredPickItems) next.add(item.id);
    this.setDraftSelectedIds([...next]);
  }

  clearDraftSelection(): void {
    this.setDraftSelectedIds([]);
  }

  clearSelection(): void {
    this.setSelectedIds([]);
  }

  private setSelectedIds(ids: number[]): void {
    const uniq = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))];
    this.selectedIds = new Set(uniq);
    this.selectedCount = this.selectedIds.size;
  }

  private setDraftSelectedIds(ids: number[]): void {
    const uniq = [...new Set(ids.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))];
    this.draftSelectedIds = new Set(uniq);
    this.draftSelectedCount = this.draftSelectedIds.size;
  }

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

  closeDetail(): void {
    this.modalVisible = false;
    this.detail = null;
    this.detailLoading = false;
  }

  displayCell(value: unknown): string {
    return this.formatCell(value).text;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img?.parentElement) return;
    const tip = document.createElement('div');
    tip.className = 'abnormal';
    tip.textContent = '图片加载失败';
    img.replaceWith(tip);
  }

  analyze(): void {
    if (this.analyzeScope === 'selected' && !this.selectedCount) {
      this.message.warning('请先勾选要分析的参数');
      return;
    }
    this.analyzing = true;
    this.analysis = '';
    const body =
      this.analyzeScope === 'selected' ? { ids: [...this.selectedIds] } : { ids: [] };

    void postSse(
      `${API_BASE}/sys-params/analyze/stream`,
      body,
      this.auth.token(),
      (ev) => {
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
    )
      .then(() => {
        this.analyzing = false;
        this.cdr.detectChanges();
        this.message.success(
          this.lastScope === 'selected'
            ? `已完成 ${this.lastSelectedCount} 条选中参数分析`
            : '已完成整体分析',
        );
      })
      .catch((error: Error) => {
        this.analyzing = false;
        this.cdr.detectChanges();
        this.message.error(error.message || 'AI 分析失败');
      });
  }

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
    void postSse(
      `${API_BASE}/sys-params/chat/stream`,
      { message },
      this.auth.token(),
      (ev) => {
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
    )
      .then(() => {
        this.chatting = false;
        this.needScrollChat = true;
        this.cdr.detectChanges();
        setTimeout(() => this.scrollChat(), 0);
      })
      .catch((error: Error) => {
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
      });
  }

  askQuick(q: string): void {
    this.chatInput = q;
    this.sendChat();
  }

  onChatEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey) return;
    e.preventDefault();
    this.sendChat();
  }

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

  private scrollChat(): void {
    if (!this.needScrollChat) return;
    const el = this.chatListRef?.nativeElement;
    if (el) {
      el.scrollTop = el.scrollHeight;
      this.needScrollChat = false;
    }
  }

  private normalizeDetail(detail: Detail): Detail {
    return {
      ...detail,
      imageUrls: Array.isArray(detail?.imageUrls) ? detail.imageUrls : [],
      raw: detail?.raw && typeof detail.raw === 'object' ? detail.raw : {},
    };
  }

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

  private openModuleTable(name: string): void {
    if (!name || name.startsWith('其他')) return;
    this.module = name;
    this.query = '';
    this.tabIndex = 0;
    this.loadTable();
    this.message.success(`已打开模块表格：${name}`);
  }

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

  private disposeCharts(): void {
    this.barChart?.dispose();
    this.pieChart?.dispose();
    this.barChart = undefined;
    this.pieChart = undefined;
  }
}
