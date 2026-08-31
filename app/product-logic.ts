export type WeekDate = { weekday: string; day: number; value: string };

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

export function addDaysKey(value: string, days: number): string {
  return localDateKey(addDays(parseLocalDate(value), days));
}

export function weekDates(anchor: string): WeekDate[] {
  const date = parseLocalDate(anchor);
  const offset = (date.getDay() + 6) % 7;
  const monday = addDays(date, -offset);
  const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
  return weekdays.map((weekday, index) => {
    const current = addDays(monday, index);
    return { weekday, day: current.getDate(), value: localDateKey(current) };
  });
}

export type HealthMetric = 'steps' | 'heartRate' | 'stress' | 'sleep' | 'pai' | 'height' | 'weight';
export type TravelKind = 'train' | 'flight';

export type NaturalCapture =
  | { kind: 'expense'; amount: number; merchant: string; category: string; source: '微信' | '支付宝' | '银行卡' }
  | { kind: 'schedule'; title: string; date: string; time: string }
  | { kind: 'travel'; travelKind: TravelKind; number: string; from: string; to: string; date: string; departTime: string; arriveTime?: string }
  | { kind: 'health'; metric: HealthMetric; value: number };

function categoryForText(text: string): string {
  if (/饭|餐|咖啡|奶茶|菜/.test(text)) return '餐饮';
  if (/车|地铁|公交|打车|加油/.test(text)) return '交通';
  if (/药|医院|挂号/.test(text)) return '医疗';
  if (/会员|订阅|话费|电费|水费/.test(text)) return '生活';
  return '其他';
}

const HEALTH_CAPTURE_PATTERNS: { metric: HealthMetric; pattern: RegExp }[] = [
  { metric: 'steps', pattern: /(?:走了?|步数)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*步/ },
  { metric: 'heartRate', pattern: /心率\s*(\d+(?:\.\d+)?)|(\d+)\s*(?:次\/分|bpm)/i },
  { metric: 'stress', pattern: /压力\s*(\d+(?:\.\d+)?)/ },
  { metric: 'sleep', pattern: /睡眠?\s*(\d+(?:\.\d+)?)\s*小时?/ },
  { metric: 'pai', pattern: /PAI\s*(\d+(?:\.\d+)?)/i },
  { metric: 'height', pattern: /身高\s*(\d+(?:\.\d+)?)/ },
  { metric: 'weight', pattern: /体重\s*(\d+(?:\.\d+)?)/ },
];

function parseHealthCapture(text: string): Extract<NaturalCapture, { kind: 'health' }> | null {
  if (/(?:¥|￥)?\s*\d+(?:\.\d{1,2})?\s*(?:元|块)/.test(text) && /花|付|买|消费|微信|支付宝|银行卡|银行/.test(text)) return null;
  for (const item of HEALTH_CAPTURE_PATTERNS) {
    const match = text.match(item.pattern);
    const raw = match?.[1] || match?.[2];
    if (!raw) continue;
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0) return { kind: 'health', metric: item.metric, value };
  }
  return null;
}

function captureDate(text: string, today: string): string {
  if (/后天/.test(text)) return addDaysKey(today, 2);
  if (/明天/.test(text)) return addDaysKey(today, 1);
  const dateMatch = text.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/);
  if (!dateMatch) return today;
  const year = dateMatch[1] || today.slice(0, 4);
  return `${year}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[3]).padStart(2, '0')}`;
}

function parseTravelCapture(text: string, today: string): Extract<NaturalCapture, { kind: 'travel' }> | null {
  const train = text.match(/([GDCZTK]\d{1,5})次?/i);
  const flight = text.match(/\b([A-Z]{2}\d{3,4})\b/i);
  const travelKind: TravelKind | null = train ? 'train' : (flight && /航班|起飞|登机|机场|飞机/.test(text) ? 'flight' : null);
  if (!travelKind) return null;
  const number = (train?.[1] || flight?.[1] || '').toUpperCase();
  const routeSource = text.replace(/今天|明天|后天/g, ' ');
  const route = routeSource.match(/([\u4e00-\u9fa5]{2,12})(?:站|机场)?\s*[-—至到]\s*([\u4e00-\u9fa5]{2,12})(?:站|机场)?/);
  const times = [...text.matchAll(/(\d{1,2})\s*(?::|：)\s*(\d{2})/g)].map((item) => `${String(Math.min(Number(item[1]), 23)).padStart(2, '0')}:${item[2]}`);
  return {
    kind: 'travel',
    travelKind,
    number,
    from: route?.[1] || '待确认',
    to: route?.[2] || '待确认',
    date: captureDate(text, today),
    departTime: times[0] || '08:00',
    arriveTime: times[1],
  };
}

export function parseNaturalCapture(text: string, today = localDateKey()): NaturalCapture {
  const health = parseHealthCapture(text);
  if (health) return health;

  const amountMatch = text.match(/(?:¥|￥)?\s*(\d+(?:\.\d{1,2})?)\s*(?:元|块)/);
  if (amountMatch && /花|付|买|消费|微信|支付宝|银行卡|银行|元|块/.test(text)) {
    const source = /支付宝/.test(text) ? '支付宝' : /银行卡|银行/.test(text) ? '银行卡' : '微信';
    const merchant = text
      .replace(amountMatch[0], ' ')
      .replace(/微信支付|支付宝支付|银行卡支付|微信|支付宝|银行卡|银行|花了|支付|付款|消费|买了|用了|用/g, ' ')
      .replace(/[，。,.!！?？、]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || '待补充商家';
    return { kind: 'expense', amount: Number(amountMatch[1]), merchant, category: categoryForText(text), source };
  }

  const travel = parseTravelCapture(text, today);
  if (travel) return travel;

  const timeMatch = text.match(/(\d{1,2})\s*(?::|：|点)\s*(\d{0,2})/);
  const hour = Math.min(Number(timeMatch?.[1] ?? 10), 23);
  const minute = Math.min(Number(timeMatch?.[2] || 0), 59);
  const date = captureDate(text, today);
  const title = text
    .replace(/今天|明天|后天/g, ' ')
    .replace(/\d{1,2}\s*(?::|：|点)\s*\d{0,2}/, ' ')
    .replace(/提醒我|提醒|安排|日程/g, ' ')
    .replace(/[，。,.!！?？、]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '新日程';
  return { kind: 'schedule', title, date, time: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}

export type PrivacyFlags = { schedule: boolean; finance: boolean; health: boolean; memory: boolean };

type ScopedSummaryInput = {
  today: string;
  month: string;
  privacy: Partial<PrivacyFlags>;
  schedules: { date: string; done: boolean; title: string }[];
  transactions: { createdAt: string }[];
  healthRecords: HealthMetricRecord[];
  memories: { active: boolean; title: string; note: string; sendAllowed?: boolean; source?: string; purpose?: string; updatedAt?: string }[];
};

export function migratePrivacySettings(raw: Partial<PrivacyFlags> | null | undefined): PrivacyFlags {
  return {
    schedule: raw?.schedule === true,
    finance: raw?.finance === true,
    health: raw?.health === true,
    memory: raw?.memory === true,
  };
}

export type HealthMetricRecord = { kind: string; value: number; createdAt?: string; note?: string; externalKey?: string };

export type HealthSnapshot = {
  date?: string;
  source?: string;
  sleepHours?: number;
  steps?: number;
  exerciseMin?: number;
  heightCm?: number;
  weightKg?: number;
  heartRate?: number;
  stress?: number;
  pai?: number;
};

const HEALTH_SUMMARY_ORDER: { kind: string; label: string; unit: string }[] = [
  { kind: 'height', label: '身高', unit: 'cm' },
  { kind: 'weight', label: '体重', unit: 'kg' },
  { kind: 'heartRate', label: '心率', unit: '次/分' },
  { kind: 'stress', label: '压力', unit: '' },
  { kind: 'sleep', label: '睡眠', unit: '小时' },
  { kind: 'pai', label: 'PAI', unit: '' },
  { kind: 'steps', label: '步数', unit: '步' },
];

export function latestHealthByKind(records: HealthMetricRecord[], kind: string): number | undefined {
  const items = records.filter((item) => item.kind === kind && Number.isFinite(item.value));
  if (!items.length) return undefined;
  return [...items].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0].value;
}

export function summarizeHealth(records: HealthMetricRecord[]): string {
  const parts = HEALTH_SUMMARY_ORDER.flatMap(({ kind, label, unit }) => {
    const value = latestHealthByKind(records, kind);
    return value == null ? [] : [`${label}${value}${unit}`];
  });
  return parts.length ? parts.join('，') : '尚无身高体重心率压力睡眠PAI记录';
}

export function healthRecordsFromSnapshots(snapshots: HealthSnapshot[], sourceFallback = 'health-connect'): HealthMetricRecord[] {
  const records: HealthMetricRecord[] = [];
  for (const snapshot of snapshots) {
    const date = snapshot.date || '';
    const source = snapshot.source || sourceFallback;
    const push = (kind: string, value: number | undefined, label: string, key = `${source}:${date}:${kind}`) => {
      if (!(Number(value) > 0)) return;
      records.push({ kind, value: Number(value), note: `${label} · ${date}`, createdAt: date, externalKey: key });
    };
    push('height', snapshot.heightCm, '身高', `${source}:profile:height`);
    push('weight', snapshot.weightKg, '体重', `${source}:profile:weight`);
    push('heartRate', snapshot.heartRate, '心率');
    push('stress', snapshot.stress, '压力');
    push('sleep', snapshot.sleepHours, '睡眠');
    push('pai', snapshot.pai, 'PAI');
    push('steps', snapshot.steps, '步数');
    if (Number(snapshot.exerciseMin) > 0) push('exercise', snapshot.exerciseMin, '运动');
  }
  return records;
}

export function buildScopedSummary(input: ScopedSummaryInput): string {
  const privacy = migratePrivacySettings(input.privacy);
  const schedule = privacy.schedule
    ? `日程未完成=${input.schedules.filter((item) => item.date === input.today && !item.done).map((item) => item.title).join('、') || '无'}`
    : '日程权限关闭';
  const finance = privacy.finance
    ? `本月流水 ${input.transactions.filter((item) => item.createdAt.startsWith(input.month)).length} 笔`
    : '财务权限关闭';
  const health = privacy.health ? summarizeHealth(input.healthRecords) : '健康权限关闭';
  const memories = privacy.memory
    ? input.memories.filter((item) => item.active && item.sendAllowed === true).map((item) => `${item.title}（${item.note}）`).join('；') || '无'
    : '记忆权限关闭';
  return `你是 Self Agent 本机管家。只能使用这些摘要：${schedule}；${finance}；${health}；用户允许的记忆=${memories}。禁止索取或输出密码、验证码、私钥、助记词、完整卡号。健康不是诊断，财务不是投资建议。`;
}

export type MemoryStatus = '使用中' | '已暂停';
export type MemoryRecord = {
  id: string;
  kind: string;
  title: string;
  note: string;
  active: boolean;
  sendAllowed: boolean;
  status: MemoryStatus;
  source: string;
  purpose: string;
  updatedAt: string;
};

export function normalizeMemory(raw: Partial<MemoryRecord> & { id?: string; title?: string; note?: string; active?: boolean; sendAllowed?: boolean }): MemoryRecord {
  const note = String(raw.note || '');
  const active = raw.active !== false;
  return {
    id: String(raw.id || ''),
    kind: String(raw.kind || '观察'),
    title: String(raw.title || '未命名记忆'),
    note,
    active,
    sendAllowed: raw.sendAllowed === true,
    status: active ? '使用中' : '已暂停',
    source: String(raw.source || '本机已有记忆'),
    purpose: String(raw.purpose || note || '用于管家建议'),
    updatedAt: String(raw.updatedAt || ''),
  };
}

export type HealthBriefing = {
  allowed: boolean;
  rangeLabel: string;
  evidence: string;
  missing: string[];
  disclaimer: string;
};

export function buildHealthBriefing(records: HealthMetricRecord[], allowed: boolean): HealthBriefing {
  const disclaimer = '这是本机记录摘要，不是诊断，也不能替代专业医疗意见。';
  if (!allowed) {
    return { allowed: false, rangeLabel: '健康权限关闭', evidence: '健康权限关闭', missing: HEALTH_SUMMARY_ORDER.map((item) => item.label), disclaimer };
  }
  const dates = records.map((item) => String(item.createdAt || '')).filter(Boolean).sort();
  const rangeLabel = dates.length ? `${dates[0]} 至 ${dates[dates.length - 1]}，共 ${records.length} 条` : '尚无健康记录';
  const missing = HEALTH_SUMMARY_ORDER.filter((item) => latestHealthByKind(records, item.kind) == null).map((item) => item.label);
  return { allowed: true, rangeLabel, evidence: summarizeHealth(records), missing, disclaimer };
}

export const BUTLER_ACTION_TYPES = [
  'create_schedule',
  'create_expense',
  'create_travel',
  'create_health',
  'add_memory',
  'update_memory',
  'pause_memory',
  'delete_memory',
] as const;

export type ButlerActionType = typeof BUTLER_ACTION_TYPES[number];
export type ButlerAction =
  | { type: 'create_schedule'; payload: { title: string; date: string; time: string } }
  | { type: 'create_expense'; payload: { amount: number; merchant: string; category?: string; source?: string; accountId?: string; currency?: string; date?: string; reimbursable?: boolean } }
  | { type: 'create_travel'; payload: { travelKind: TravelKind; number: string; from: string; to: string; date: string; departTime: string; arriveTime?: string } }
  | { type: 'create_health'; payload: { metric: HealthMetric; value: number } }
  | { type: 'add_memory'; payload: { title: string; note?: string; kind?: string; purpose?: string } }
  | { type: 'update_memory'; payload: { id: string; title?: string; note?: string; purpose?: string } }
  | { type: 'pause_memory'; payload: { id: string } }
  | { type: 'delete_memory'; payload: { id: string } };

export type ButlerModelResponse = { reply: string; actions: ButlerAction[]; mutatesState: false };

const SECRET_FIELD = /password|passwd|secret|apikey|token|otp|seed|mnemonic|私钥|密码|验证码|助记词/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const HEALTH_METRICS: HealthMetric[] = ['steps', 'heartRate', 'stress', 'sleep', 'pai', 'height', 'weight'];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function hasSecretFields(payload: Record<string, unknown>): boolean {
  return Object.entries(payload).some(([key, value]) => SECRET_FIELD.test(key) || (typeof value === 'string' && SECRET_FIELD.test(value)));
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function validateButlerAction(value: unknown): ButlerAction | null {
  if (!isPlainObject(value)) return null;
  const type = value.type;
  const payload = value.payload;
  if (typeof type !== 'string' || !BUTLER_ACTION_TYPES.includes(type as ButlerActionType) || !isPlainObject(payload) || hasSecretFields(payload)) return null;
  if (type === 'create_schedule') {
    const title = requiredString(payload.title);
    const date = requiredString(payload.date);
    const time = requiredString(payload.time);
    if (!title || !date || !time || !DATE_RE.test(date) || !TIME_RE.test(time)) return null;
    return { type, payload: { title, date, time } };
  }
  if (type === 'create_expense') {
    const amount = Number(payload.amount);
    const merchant = requiredString(payload.merchant);
    if (!(amount > 0) || !merchant) return null;
    if (!('accountId' in payload) || !('currency' in payload) || !('date' in payload) || !('reimbursable' in payload)) return null;
    const accountId = payload.accountId == null ? '' : String(payload.accountId);
    const currency = payload.currency == null ? '' : String(payload.currency);
    const date = payload.date == null ? '' : String(payload.date);
    const reimbursable = payload.reimbursable === true ? true : payload.reimbursable === false ? false : undefined;
    return { type, payload: { amount, merchant, category: requiredString(payload.category) || undefined, source: requiredString(payload.source) || undefined, accountId, currency, date, reimbursable } };
  }
  if (type === 'create_travel') {
    const travelKind = payload.travelKind === 'flight' ? 'flight' : payload.travelKind === 'train' ? 'train' : null;
    const number = requiredString(payload.number);
    const from = requiredString(payload.from);
    const to = requiredString(payload.to);
    const date = requiredString(payload.date);
    const departTime = requiredString(payload.departTime);
    if (!travelKind || !number || !from || !to || !date || !departTime || !DATE_RE.test(date) || !TIME_RE.test(departTime)) return null;
    const arriveTime = requiredString(payload.arriveTime);
    return { type, payload: { travelKind, number, from, to, date, departTime, arriveTime: arriveTime && TIME_RE.test(arriveTime) ? arriveTime : undefined } };
  }
  if (type === 'create_health') {
    const metric = HEALTH_METRICS.includes(payload.metric as HealthMetric) ? payload.metric as HealthMetric : null;
    const metricValue = Number(payload.value);
    if (!metric || !(metricValue > 0)) return null;
    return { type, payload: { metric, value: metricValue } };
  }
  if (type === 'add_memory') {
    const title = requiredString(payload.title);
    if (!title) return null;
    return { type, payload: { title, note: requiredString(payload.note) || undefined, kind: requiredString(payload.kind) || undefined, purpose: requiredString(payload.purpose) || undefined } };
  }
  const id = requiredString(payload.id);
  if (!id) return null;
  if (type === 'update_memory') {
    return { type, payload: { id, title: requiredString(payload.title) || undefined, note: requiredString(payload.note) || undefined, purpose: requiredString(payload.purpose) || undefined } };
  }
  if (type === 'pause_memory' || type === 'delete_memory') return { type, payload: { id } };
  return null;
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || text).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as unknown;
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseButlerModelOutput(text: string): ButlerModelResponse {
  const parsed = extractJsonObject(text);
  if (!parsed) return { reply: text.trim(), actions: [], mutatesState: false };
  const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : text.trim();
  const actions = Array.isArray(parsed.actions)
    ? parsed.actions.map(validateButlerAction).filter((item): item is ButlerAction => Boolean(item))
    : [];
  return { reply, actions, mutatesState: false };
}

export function describeButlerDataScope(privacy: Partial<PrivacyFlags>) {
  const flags = migratePrivacySettings(privacy);
  return [
    { key: 'schedule', label: '日程', allowed: flags.schedule },
    { key: 'finance', label: '财务', allowed: flags.finance },
    { key: 'health', label: '健康', allowed: flags.health },
    { key: 'memory', label: '记忆', allowed: flags.memory },
    { key: 'vault', label: '密码', allowed: false },
  ] as const;
}

export function buildButlerSystemPrompt(input: ScopedSummaryInput & { vaultItems?: unknown }): string {
  const privacy = migratePrivacySettings(input.privacy);
  const briefing = buildHealthBriefing(input.healthRecords, privacy.health);
  const healthLine = privacy.health
    ? `健康数据范围=${briefing.rangeLabel}；证据=${briefing.evidence}；缺失=${briefing.missing.join('、') || '无'}；${briefing.disclaimer}`
    : `健康权限关闭；${briefing.disclaimer}`;
  return [
    buildScopedSummary(input),
    '模型只能返回草稿，禁止直接改本地状态。用户确认后才会写入。',
    '可用动作：create_schedule、create_expense、create_travel、create_health、add_memory、update_memory、pause_memory、delete_memory。',
    '请只输出 JSON：{"reply":"简体中文回复","actions":[{"type":"动作名","payload":{}}]}。没有动作时 actions 为空数组。',
    healthLine,
    '密码、验证码、私钥、助记词、完整卡号永不进入上下文，也不许索取。财务不是投资建议。健康分析不是诊断。',
  ].join('\n');
}

export function detectLegacyDemoData(raw: { schedules?: { id?: string }[]; accounts?: { id?: string }[] }): boolean {
  return Boolean(raw.schedules?.some((item) => item.id === 's1') && raw.accounts?.some((item) => item.id === 'wechat'));
}

export function isBackupPayload(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.schedules) || !Array.isArray(raw.accounts) || !Array.isArray(raw.transactions)) return false;
  const optionalArrays = ['recurringRules', 'healthRecords', 'travels', 'investments', 'memories', 'vaultItems', 'inboxItems', 'auditLog'];
  return optionalArrays.every((key) => raw[key] === undefined || Array.isArray(raw[key]));
}

export type AssetAccount = { currency: string; balance: number };
export type AssetLine = { currency: string; amount: number };

const ASSET_CURRENCY_ORDER = ['CNY', 'USD', 'HKD', 'EUR', 'JPY'];

export function assetTotals(accounts: AssetAccount[]): AssetLine[] {
  const totals = new Map<string, number>();
  for (const account of accounts) {
    const currency = account.currency || 'CNY';
    const balance = Number.isFinite(account.balance) ? account.balance : 0;
    totals.set(currency, (totals.get(currency) ?? 0) + balance);
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((left, right) => {
      const leftRank = ASSET_CURRENCY_ORDER.indexOf(left.currency);
      const rightRank = ASSET_CURRENCY_ORDER.indexOf(right.currency);
      return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank) || left.currency.localeCompare(right.currency);
    });
}

export type AccountRole = 'asset' | 'receivable' | 'liability' | 'payable' | 'plan';

export function accountRole(type: string): AccountRole {
  if (/报销|待收回|应收/.test(type)) return 'receivable';
  if (/信用卡|待还款|信贷|花呗|白条/.test(type)) return 'liability';
  if (/欠款|应付/.test(type)) return 'payable';
  if (/订阅/.test(type)) return 'plan';
  return 'asset';
}

export function isDebtRole(role: AccountRole): boolean {
  return role === 'liability' || role === 'payable';
}

export function normalizeAccountBalance(type: string, balance: number): number {
  const value = Number.isFinite(balance) ? balance : 0;
  return isDebtRole(accountRole(type)) ? Math.abs(value) : value;
}

export type WealthAccount = { id?: string; type: string; currency: string; balance: number };
export type WealthHolding = { accountId?: string; quantity: number; currentPrice: number };
export type WealthLine = {
  currency: string;
  assets: number;
  receivable: number;
  liability: number;
  payable: number;
  net: number;
};

export type WealthTxn = {
  kind: string;
  currency?: string;
  amount?: number;
  accountAmount?: number;
  reimbursable?: boolean;
  reimbursed?: boolean;
  reimburseAccountId?: string;
};

export function wealthTotals(accounts: WealthAccount[], transactions: WealthTxn[] = [], holdings: WealthHolding[] = []): WealthLine[] {
  const map = new Map<string, WealthLine>();
  const line = (currency: string) => map.get(currency) ?? { currency, assets: 0, receivable: 0, liability: 0, payable: 0, net: 0 };
  for (const account of accounts) {
    const currency = account.currency || 'CNY';
    const current = line(currency);
    const amount = normalizeAccountBalance(account.type, account.balance);
    const role = accountRole(account.type);
    if (role === 'asset') current.assets += amount;
    else if (role === 'receivable') current.receivable += amount;
    else if (role === 'liability') current.payable += amount;
    else if (role === 'payable') current.payable += amount;
    map.set(currency, current);
  }
  for (const holding of holdings) {
    const account = accounts.find((item) => item.id && item.id === holding.accountId);
    const currency = account?.currency || 'CNY';
    const current = line(currency);
    current.assets += Number(holding.quantity) * Number(holding.currentPrice);
    map.set(currency, current);
  }
  for (const transaction of transactions) {
    if (transaction.kind !== 'expense' || !transaction.reimbursable || transaction.reimbursed) continue;
    const claim = accounts.find((account) => account.id === transaction.reimburseAccountId);
    if (claim && accountRole(claim.type) === 'receivable') continue;
    const currency = transaction.currency || 'CNY';
    const current = line(currency);
    current.receivable += Number(transaction.accountAmount ?? transaction.amount ?? 0);
    map.set(currency, current);
  }
  return [...map.values()]
    .map((item) => ({ ...item, liability: item.payable, net: item.assets + item.receivable - item.payable }))
    .sort((left, right) => {
      const leftRank = ASSET_CURRENCY_ORDER.indexOf(left.currency);
      const rightRank = ASSET_CURRENCY_ORDER.indexOf(right.currency);
      return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank) || left.currency.localeCompare(right.currency);
    });
}

export type ExchangeRate = {
  currency: string;
  cnyRate: number;
  asOf: string;
  source: 'manual' | 'daily';
  updatedAt: string;
};

export type CnyWealthTotal = { convertedCny: number; unresolved: AssetLine[] };

function validRateDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function cnyWealthTotal(accounts: WealthAccount[], transactions: WealthTxn[] = [], rates: ExchangeRate[] = [], holdings: WealthHolding[] = []): CnyWealthTotal {
  const ratesByCurrency = new Map(rates.filter((rate) => Number.isFinite(rate.cnyRate) && rate.cnyRate > 0 && validRateDate(rate.asOf) && Number.isFinite(Date.parse(rate.updatedAt))).map((rate) => [rate.currency, rate]));
  let convertedCny = 0;
  const unresolved = new Map<string, number>();
  for (const line of wealthTotals(accounts, transactions, holdings)) {
    const rate = line.currency === 'CNY' ? 1 : ratesByCurrency.get(line.currency)?.cnyRate;
    if (!rate) {
      unresolved.set(line.currency, (unresolved.get(line.currency) ?? 0) + line.net);
      continue;
    }
    convertedCny += line.net * rate;
  }
  return {
    convertedCny,
    unresolved: [...unresolved.entries()].map(([currency, amount]) => ({ currency, amount })).filter((line) => line.amount !== 0),
  };
}

export type LegacyReimbursementTxn = WealthTxn & { reimburseAccountId?: string };



export function migrateLegacyReimbursementAccounts<TA extends WealthAccount & { id: string }, TT extends LegacyReimbursementTxn>(
  accounts: TA[],
  transactions: TT[],
): { accounts: TA[]; transactions: TT[] } {
  const legacyIds = new Set(accounts.filter((account) => /报销账户/.test(account.type)).map((account) => account.id));
  if (!legacyIds.size) return { accounts, transactions };
  const linkedAmount = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.kind !== 'expense' || !transaction.reimbursable || transaction.reimbursed || !transaction.reimburseAccountId || !legacyIds.has(transaction.reimburseAccountId)) continue;
    linkedAmount.set(transaction.reimburseAccountId, (linkedAmount.get(transaction.reimburseAccountId) ?? 0) + Math.abs(Number(transaction.accountAmount ?? transaction.amount ?? 0)));
  }
  const migratedAccounts = accounts.flatMap((account) => {
    if (!legacyIds.has(account.id)) return [account];
    const residual = Math.max(0, normalizeAccountBalance(account.type, account.balance) - (linkedAmount.get(account.id) ?? 0));
    return residual ? [{ ...account, type: '待收回', balance: residual } as TA] : [];
  });
  const migratedTransactions = transactions.map((transaction) => legacyIds.has(transaction.reimburseAccountId ?? '')
    ? { ...transaction, reimburseAccountId: undefined } as TT
    : transaction);
  return { accounts: migratedAccounts, transactions: migratedTransactions };
}

export function upsertByExternalKey<T extends { externalKey?: string }>(current: T[], incoming: T[]): T[] {
  const keys = new Set(incoming.map((item) => item.externalKey).filter((key): key is string => Boolean(key)));
  return [...incoming, ...current.filter((item) => !item.externalKey || !keys.has(item.externalKey))];
}

export type DailyPriceQuote = { holdingId: string; price: number; asOf: string; source: string };

export function applyDailyPriceQuotes<T extends { id: string; currentPrice: number; updatedAt: string; quoteStatus: unknown; history: { date: string; price: number }[] }>(holdings: T[], quotes: DailyPriceQuote[]): T[] {
  const latest = new Map<string, DailyPriceQuote>();
  for (const quote of quotes) if (quote.holdingId && Number.isFinite(quote.price) && quote.price > 0 && /^\d{4}-\d{2}-\d{2}/.test(quote.asOf)) latest.set(quote.holdingId, quote);
  return holdings.map((holding) => {
    const quote = latest.get(holding.id);
    if (!quote) return holding;
    const date = quote.asOf.slice(5, 10);
    return { ...holding, currentPrice: quote.price, updatedAt: quote.asOf, quoteStatus: 'live', history: [...holding.history.filter((point) => point.date !== date), { date, price: quote.price }].slice(-30) } as T;
  });
}

export function applyDailyFxRates(current: ExchangeRate[], incoming: ExchangeRate[]): ExchangeRate[] {
  const next = [...current];
  for (const rate of incoming) {
    if (!rate.currency || rate.currency === 'CNY' || !(rate.cnyRate > 0) || !validRateDate(rate.asOf)) continue;
    const item: ExchangeRate = { currency: rate.currency, cnyRate: rate.cnyRate, asOf: rate.asOf, source: 'daily', updatedAt: rate.updatedAt || rate.asOf };
    const index = next.findIndex((existing) => existing.currency === rate.currency);
    if (index >= 0) next[index] = item;
    else next.push(item);
  }
  return next;
}

export type LedgerAccount = { id: string; name?: string; type: string; currency: string; balance: number };
export type LedgerTxn = {
  kind: 'expense' | 'income' | 'transfer' | 'adjustment' | 'settlement';
  accountId: string;
  targetAccountId?: string;
  accountAmount: number;
  reimbursable?: boolean;
  reimburseAccountId?: string;
  reimbursed?: boolean;
};

const POSTING_ACCOUNT_RE = /资金账户|储蓄卡|现金|储值账户|信用卡/;

export function resolvePaymentAccountId(accounts: LedgerAccount[], source?: string, accountHint?: string): string | undefined {
  const candidates = accounts.filter((account) => POSTING_ACCOUNT_RE.test(account.type));
  const exact = candidates.find((account) => account.id === source || account.id === accountHint);
  if (exact) return exact.id;
  const raw = `${source ?? ''}${accountHint ?? ''}`.toLowerCase();
  const tokens = [
    /alipay|支付宝/.test(raw) ? '支付宝' : '',
    /wechat|微信/.test(raw) ? '微信' : '',
    accountHint?.trim() ?? '',
  ].filter(Boolean);
  return candidates.find((account) => tokens.some((token) => `${account.name ?? ''}${account.type}${account.id}`.toLowerCase().includes(token.toLowerCase())))?.id;
}

export function defaultCashId(accounts: LedgerAccount[], currency: string): string | undefined {
  const matches = accounts.filter((account) => accountRole(account.type) === 'asset' && account.currency === currency && !/物品资产|理财账户/.test(account.type));
  return (matches.find((account) => /资金|储蓄|现金|支付宝|微信|银行/.test(`${account.type}${account.name ?? ''}${account.id}`)) ?? matches[0])?.id;
}

function ledgerDelta(account: LedgerAccount, transaction: LedgerTxn): number {
  const amount = transaction.accountAmount;
  const role = accountRole(account.type);
  const debt = isDebtRole(role);
  if (account.id === transaction.accountId) {
    if (transaction.kind === 'income') return debt ? -amount : amount;
    if (transaction.kind === 'expense') return debt ? amount : -amount;
    if (transaction.kind === 'transfer' || transaction.kind === 'settlement') return debt ? amount : -amount;
    if (transaction.kind === 'adjustment') return amount;
  }
  if (transaction.kind === 'expense' && transaction.reimbursable && !transaction.reimbursed && account.id === transaction.reimburseAccountId && role === 'receivable') {
    return amount;
  }
  if ((transaction.kind === 'transfer' || transaction.kind === 'settlement') && account.id === transaction.targetAccountId) {
    return debt ? -amount : amount;
  }
  return 0;
}

export function canApplyLedger(accounts: LedgerAccount[], transaction: LedgerTxn, factor: 1 | -1 = 1): boolean {
  return accounts.every((account) => !isDebtRole(accountRole(account.type)) || account.balance + ledgerDelta(account, transaction) * factor >= 0);
}

export function applyLedger<T extends LedgerAccount>(accounts: T[], transaction: LedgerTxn, factor: 1 | -1): T[] {
  if (!canApplyLedger(accounts, transaction, factor)) return accounts;
  return accounts.map((account) => {
    const delta = ledgerDelta(account, transaction) * factor;
    if (!delta) return account;
    const next = account.balance + delta;
    return { ...account, balance: isDebtRole(accountRole(account.type)) ? Math.max(0, next) : next };
  });
}

export type SettlementPlan =
  | { ok: true; transaction: LedgerTxn }
  | { ok: false; reason: string };

export function planAccountSettlement(accounts: LedgerAccount[], accountId: string, counterpartId: string, amount: number): SettlementPlan {
  const account = accounts.find((item) => item.id === accountId);
  const counterpart = accounts.find((item) => item.id === counterpartId);
  if (!account || account.balance <= 0) return { ok: false, reason: '没有可结算的余额' };
  if (!counterpart || counterpart.id === account.id) return { ok: false, reason: '请选择另一个账户' };
  if (counterpart.currency !== account.currency) return { ok: false, reason: '请选择同币种账户' };
  if (!(amount > 0)) return { ok: false, reason: '请输入大于 0 的金额' };
  if (amount > account.balance) return { ok: false, reason: '金额不能超过当前余额' };
  const counterpartIsCash = accountRole(counterpart.type) === 'asset' && !/物品资产|订阅账户/.test(counterpart.type);
  if (!counterpartIsCash) return { ok: false, reason: '请选择资金账户' };
  const role = accountRole(account.type);
  if (role === 'receivable') {
    const transaction: LedgerTxn = { kind: 'transfer', accountId: account.id, targetAccountId: counterpart.id, accountAmount: amount };
    return { ok: true, transaction };
  }
  if (isDebtRole(role)) {
    const transaction: LedgerTxn = { kind: 'transfer', accountId: counterpart.id, targetAccountId: account.id, accountAmount: amount };
    if (!canApplyLedger(accounts, transaction)) return { ok: false, reason: '资金账户余额不足，或超过当前欠款' };
    return { ok: true, transaction };
  }
  return { ok: false, reason: '这个账户不需要收回或还款' };
}

export type LinkedLedgerTxn = LedgerTxn & {
  id: string;
  reimbursementForId?: string;
  reimbursementTransactionId?: string;
};

export function settleReimbursementState<TA extends LedgerAccount, TT extends LinkedLedgerTxn>(
  accounts: TA[],
  transactions: TT[],
  originalId: string,
  credit: TT,
): { accounts: TA[]; transactions: TT[] } {
  const original = transactions.find((item) => item.id === originalId);
  if (!original?.reimbursable || original.reimbursed) return { accounts, transactions };
  const linkedCredit = { ...credit, reimbursementForId: original.id } as TT;
  const ledgerCredit = linkedCredit.kind === 'settlement' || linkedCredit.kind === 'adjustment'
    ? { ...linkedCredit, kind: linkedCredit.kind === 'settlement' ? 'settlement' as const : 'adjustment' as const }
    : linkedCredit;
  let nextAccounts = applyLedger(accounts, ledgerCredit, 1);
  const claim = accounts.find((account) => account.id === original.reimburseAccountId);
  const touchesClaim = Boolean(claim && (linkedCredit.accountId === claim.id || linkedCredit.targetAccountId === claim.id));
  if (claim && accountRole(claim.type) === 'receivable' && !touchesClaim) {
    nextAccounts = applyLedger(nextAccounts, { kind: 'expense', accountId: claim.id, accountAmount: original.accountAmount }, 1);
  }
  return {
    accounts: nextAccounts,
    transactions: [
      linkedCredit,
      ...transactions.map((item) => item.id === original.id
        ? { ...item, reimbursed: true, reimbursementTransactionId: linkedCredit.id } as TT
        : item),
    ],
  };
}

export function removeLedgerTransactionState<TA extends LedgerAccount, TT extends LinkedLedgerTxn>(
  accounts: TA[],
  transactions: TT[],
  id: string,
): { accounts: TA[]; transactions: TT[] } {
  const previous = transactions.find((item) => item.id === id);
  if (!previous) return { accounts, transactions };
  let nextAccounts = applyLedger(accounts, previous, -1);
  let nextTransactions = transactions.filter((item) => item.id !== previous.id);
  if (previous.reimbursementForId) {
    nextTransactions = nextTransactions.map((item) => item.id === previous.reimbursementForId
      ? { ...item, reimbursed: false, reimbursementTransactionId: undefined } as TT
      : item);
    const original = nextTransactions.find((item) => item.id === previous.reimbursementForId);
    const claim = original ? nextAccounts.find((account) => account.id === original.reimburseAccountId) : undefined;
    if (original && claim && accountRole(claim.type) === 'receivable') {
      nextAccounts = applyLedger(nextAccounts, { kind: 'income', accountId: claim.id, accountAmount: original.accountAmount }, 1);
    }
  }
  if (previous.reimbursementTransactionId) {
    const credit = transactions.find((item) => item.id === previous.reimbursementTransactionId);
    if (credit) nextAccounts = applyLedger(nextAccounts, credit, -1);
    nextTransactions = nextTransactions.filter((item) => item.id !== previous.reimbursementTransactionId);
  }
  return { accounts: nextAccounts, transactions: nextTransactions };
}

export type RecurringRuleState = { id: string; lastRunPeriod?: string };
export type RecurringPosting = { recurringRuleId?: string; createdAt?: string };

export function reconcileRecurringConfirmations<TR extends RecurringRuleState>(
  rules: TR[],
  transactions: RecurringPosting[],
): TR[] {
  return rules.map((rule) => {
    if (!rule.lastRunPeriod) return rule;
    const posted = transactions.some((item) => item.recurringRuleId === rule.id && item.createdAt?.slice(0, 7) === rule.lastRunPeriod);
    return posted ? rule : { ...rule, lastRunPeriod: undefined };
  });
}

export function releaseRecurringConfirmation<TR extends RecurringRuleState>(
  rules: TR[],
  remainingTransactions: RecurringPosting[],
  deleted: RecurringPosting,
): TR[] {
  const period = deleted.createdAt?.slice(0, 7);
  if (!deleted.recurringRuleId || !period) return reconcileRecurringConfirmations(rules, remainingTransactions);
  const stillPosted = remainingTransactions.some((item) => item.recurringRuleId === deleted.recurringRuleId && item.createdAt?.slice(0, 7) === period);
  if (stillPosted) return rules;
  return rules.map((rule) => rule.id === deleted.recurringRuleId && rule.lastRunPeriod === period
    ? { ...rule, lastRunPeriod: undefined }
    : rule);
}


export const AI_CONFIG_STORAGE_KEY = 'self-agent:ai-config:v1';
export const AI_EVENT_VERSION = 1;
export const AI_CONFIG_EVENT = 'self-agent:ai-config';
export const AI_REPLY_EVENT = 'self-agent:ai-reply';

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type AiSecretConfig = { baseUrl: string; model: string; apiKey: string };
export type AiPublicConfig = { baseUrl: string; model: string; configured: boolean };
export type AiRuntimeConfig = AiPublicConfig & { apiKey: string };

export function normalizeAiBaseUrl(raw: string): string {
  return String(raw || '').trim().replace(/\/+$/, '');
}

export function publicAiConfig(raw: Partial<AiSecretConfig> & { configured?: boolean; password?: unknown; vaultItems?: unknown } | null | undefined): AiPublicConfig {
  const baseUrl = normalizeAiBaseUrl(String(raw?.baseUrl || ''));
  const model = String(raw?.model || '').trim() || 'gpt-4o-mini';
  const apiKey = String(raw?.apiKey || '').trim();
  return { baseUrl, model, configured: Boolean(raw?.configured) || Boolean(baseUrl && apiKey) };
}

export function versionedAiEvent<T extends Record<string, unknown>>(detail: T): { v: number } & T {
  const rest = { ...detail } as Record<string, unknown>;
  delete rest.apiKey;
  delete rest.password;
  delete rest.vaultItems;
  return { v: AI_EVENT_VERSION, ...(rest as T) };
}

function parseAiObject(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function migrateLegacyAiLocalStorage(local: StorageLike): AiSecretConfig | null {
  const parsed = parseAiObject(local.getItem(AI_CONFIG_STORAGE_KEY));
  local.removeItem(AI_CONFIG_STORAGE_KEY);
  if (!parsed) return null;
  const published = publicAiConfig(parsed as Partial<AiSecretConfig>);
  const apiKey = String(parsed.apiKey || '').trim();
  if (!published.baseUrl && !apiKey) return null;
  return { baseUrl: published.baseUrl, model: published.model, apiKey };
}

export function persistBrowserAiConfig(session: StorageLike, local: StorageLike, config: Partial<AiSecretConfig>): AiPublicConfig {
  local.removeItem(AI_CONFIG_STORAGE_KEY);
  const published = publicAiConfig(config);
  session.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
    baseUrl: published.baseUrl,
    model: published.model,
    apiKey: String(config.apiKey || '').trim(),
  }));
  return published;
}

export function loadBrowserAiConfig(session: StorageLike, local: StorageLike): AiRuntimeConfig {
  const leftover = migrateLegacyAiLocalStorage(local);
  const fromSession = parseAiObject(session.getItem(AI_CONFIG_STORAGE_KEY));
  if (!fromSession && leftover) persistBrowserAiConfig(session, local, leftover);
  const source = (fromSession || leftover || {}) as Partial<AiSecretConfig>;
  const published = publicAiConfig(source);
  const apiKey = String(source.apiKey || leftover?.apiKey || '').trim();
  return { ...published, apiKey, configured: Boolean(published.baseUrl && apiKey) };
}

export const INBOX_SOURCES = ['payment', 'travel', 'ocr', 'voice', 'manual', 'ai'] as const;
export type InboxSource = typeof INBOX_SOURCES[number];
export const INBOX_STATUSES = ['pending', 'confirmed', 'ignored'] as const;
export type InboxStatus = typeof INBOX_STATUSES[number];
export const INBOX_ACTIONS = [
  'create_expense',
  'create_income',
  'create_schedule',
  'create_travel',
  'update_travel',
  'create_health',
  'add_memory',
  'update_memory',
  'pause_memory',
  'delete_memory',
] as const;
export type InboxProposedAction = typeof INBOX_ACTIONS[number];

export const INBOX_SOURCE_LABELS: Record<InboxSource, string> = {
  payment: '支付通知',
  travel: '行程更新',
  ocr: '图片识别',
  voice: '语音',
  manual: '手动输入',
  ai: '管家建议',
};

export const INBOX_ACTION_LABELS: Record<InboxProposedAction, string> = {
  create_expense: '记一笔支出',
  create_income: '记一笔收入',
  create_schedule: '添加日程',
  create_travel: '添加行程',
  update_travel: '更新行程',
  create_health: '记录健康',
  add_memory: '新增记忆',
  update_memory: '更新记忆',
  pause_memory: '暂停记忆',
  delete_memory: '删除记忆',
};

export type InboxItem = {
  id: string;
  source: InboxSource;
  confidence: number;
  proposedAction: InboxProposedAction;
  payload: Record<string, unknown>;
  preview: string;
  createdAt: string;
  status: InboxStatus;
  dedupeKey: string;
  resultEntityId?: string;
};

export type InboxStore = {
  inboxItems: InboxItem[];
  lastConfirmedInboxId: string | null;
};

const INBOX_SECRET = /password|passwd|secret|apikey|api_key|token|otp|seed|mnemonic|私钥|密码|验证码|助记词/i;
const INBOX_SOURCE_SET = new Set<string>(INBOX_SOURCES);
const INBOX_STATUS_SET = new Set<string>(INBOX_STATUSES);
const INBOX_ACTION_SET = new Set<string>(INBOX_ACTIONS);

export function inboxSourceLabel(source: InboxSource | string): string {
  return INBOX_SOURCE_LABELS[source as InboxSource] || '未知来源';
}

export function inboxDefaultConfidence(source: InboxSource): number {
  if (source === 'payment') return 0.82;
  if (source === 'travel') return 0.88;
  if (source === 'ocr') return 0.62;
  if (source === 'voice') return 0.72;
  if (source === 'manual') return 0.9;
  return 0.58;
}

export function inboxConfidenceLabel(confidence: number): string {
  const value = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0;
  return `${Math.round(value * 100)}%`;
}

function inboxIsPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function sanitizeInboxPayload(raw: unknown): Record<string, unknown> {
  if (!inboxIsPlainObject(raw)) return {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (INBOX_SECRET.test(key)) continue;
    if (typeof value === 'string' && INBOX_SECRET.test(value)) continue;
    if (inboxIsPlainObject(value)) {
      const nested = sanitizeInboxPayload(value);
      if (Object.keys(nested).length) next[key] = nested;
      continue;
    }
    if (Array.isArray(value) || value === undefined) continue;
    next[key] = value;
  }
  return next;
}

function stableInboxValue(value: unknown): string {
  if (inboxIsPlainObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableInboxValue(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function inboxDedupeKey(input: {
  source: InboxSource;
  proposedAction: InboxProposedAction;
  payload: Record<string, unknown>;
  fingerprint?: string;
}): string {
  if (input.fingerprint) return String(input.fingerprint);
  const payload = input.payload;
  if (input.source === 'payment' || input.proposedAction === 'create_expense' || input.proposedAction === 'create_income') {
    const amount = payload.amount ?? payload.accountAmount ?? '';
    const merchant = payload.merchant ?? payload.title ?? '';
    return `payment:${amount}:${merchant}:${payload.accountId ?? payload.source ?? ''}`;
  }
  if (input.proposedAction === 'create_travel' || input.proposedAction === 'update_travel') {
    const date = String(payload.date || payload.departAt || '').slice(0, 10);
    return `travel:${payload.travelKind || payload.kind || ''}:${payload.number || ''}:${date}`;
  }
  return `${input.source}:${input.proposedAction}:${stableInboxValue(payload)}`;
}

export function inboxPreviewFor(action: InboxProposedAction, payload: Record<string, unknown>): string {
  if (action === 'create_expense' || action === 'create_income') {
    return `${payload.merchant || payload.title || '支付'} · ${payload.amount ?? '待补金额'}`;
  }
  if (action === 'create_schedule') return `${payload.date || ''} ${payload.time || ''} · ${payload.title || '新日程'}`.trim();
  if (action === 'create_travel' || action === 'update_travel') {
    return `${payload.travelKind === 'flight' || payload.kind === 'flight' ? '航班' : '火车'} ${payload.number || ''} ${payload.from || ''} → ${payload.to || ''}`.replace(/\s+/g, ' ').trim();
  }
  if (action === 'create_health') return `${payload.metric || '健康'} ${payload.value ?? ''}`.trim();
  if (action === 'add_memory' || action === 'update_memory') return String(payload.title || payload.note || '记忆草稿');
  return String(payload.title || payload.id || INBOX_ACTION_LABELS[action]);
}

export function normalizeInboxItem(raw: unknown, fallbackCreatedAt = ''): InboxItem | null {
  if (!inboxIsPlainObject(raw)) return null;
  const source = INBOX_SOURCE_SET.has(String(raw.source)) ? String(raw.source) as InboxSource : null;
  const proposedAction = INBOX_ACTION_SET.has(String(raw.proposedAction)) ? String(raw.proposedAction) as InboxProposedAction : null;
  if (!source || !proposedAction) return null;
  const payload = sanitizeInboxPayload(raw.payload);
  const createdAt = String(raw.createdAt || fallbackCreatedAt || '');
  const id = String(raw.id || '').trim() || `inbox-${createdAt || 'legacy'}-${source}-${proposedAction}`;
  const confidenceRaw = Number(raw.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : inboxDefaultConfidence(source);
  const status = INBOX_STATUS_SET.has(String(raw.status)) ? String(raw.status) as InboxStatus : 'pending';
  const preview = String(raw.preview || inboxPreviewFor(proposedAction, payload) || '').slice(0, 200);
  const resultEntityId = typeof raw.resultEntityId === 'string' && raw.resultEntityId.trim() ? raw.resultEntityId.trim() : undefined;
  return {
    id,
    source,
    confidence,
    proposedAction,
    payload,
    preview,
    createdAt,
    status,
    dedupeKey: String(raw.dedupeKey || inboxDedupeKey({ source, proposedAction, payload, fingerprint: typeof raw.fingerprint === 'string' ? raw.fingerprint : undefined })),
    resultEntityId,
  };
}

export function normalizeInboxItems(raw: unknown): InboxItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: InboxItem[] = [];
  for (const entry of raw) {
    const item = normalizeInboxItem(entry);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

export function migrateInboxStore(raw: unknown): InboxStore {
  if (!inboxIsPlainObject(raw)) return { inboxItems: [], lastConfirmedInboxId: null };
  const inboxItems = normalizeInboxItems(raw.inboxItems);
  const last = typeof raw.lastConfirmedInboxId === 'string' && inboxItems.some((item) => item.id === raw.lastConfirmedInboxId)
    ? raw.lastConfirmedInboxId
    : null;
  return { inboxItems, lastConfirmedInboxId: last };
}

export function pendingInboxItems(items: InboxItem[]): InboxItem[] {
  return items.filter((item) => item.status === 'pending');
}

export function pendingInboxCount(items: InboxItem[]): number {
  return pendingInboxItems(items).length;
}

export function enqueueInboxItem(items: InboxItem[], incoming: InboxItem | null): InboxItem[] {
  const item = incoming ? normalizeInboxItem(incoming) : null;
  if (!item) return items;
  const pending = item.status === 'pending';
  if (pending) {
    const index = items.findIndex((existing) => existing.status === 'pending' && existing.dedupeKey === item.dedupeKey);
    if (index >= 0) {
      const existing = items[index];
      const merged: InboxItem = {
        ...existing,
        source: item.source,
        confidence: item.confidence,
        proposedAction: item.proposedAction,
        payload: item.payload,
        preview: item.preview,
        status: 'pending',
        dedupeKey: existing.dedupeKey,
      };
      return [merged, ...items.filter((_, current) => current !== index)];
    }
  }
  return [item, ...items.filter((existing) => existing.id !== item.id)];
}

export function ignoreInboxItem(items: InboxItem[], id: string): InboxItem[] {
  return items.map((item) => item.id === id && item.status === 'pending' ? { ...item, status: 'ignored' } : item);
}

export function confirmInboxItem(items: InboxItem[], id: string, resultEntityId?: string): InboxItem[] {
  return items.map((item) => item.id === id && item.status === 'pending'
    ? { ...item, status: 'confirmed', resultEntityId: resultEntityId || item.resultEntityId }
    : item);
}

export function updateInboxItemPayload(items: InboxItem[], id: string, payload: Record<string, unknown>): InboxItem[] {
  return items.map((item) => {
    if (item.id !== id || item.status !== 'pending') return item;
    const nextPayload = sanitizeInboxPayload({ ...item.payload, ...payload });
    return { ...item, payload: nextPayload, preview: inboxPreviewFor(item.proposedAction, nextPayload) };
  });
}

export function reopenInboxItem(items: InboxItem[], id: string): InboxItem[] {
  return items.map((item) => item.id === id && item.status === 'confirmed'
    ? { ...item, status: 'pending', resultEntityId: undefined }
    : item);
}

export function canUndoInboxConfirm(item: InboxItem | undefined | null): boolean {
  return Boolean(item && item.status === 'confirmed' && (item.proposedAction === 'create_expense' || item.proposedAction === 'create_income') && item.resultEntityId);
}

export function inboxItemFromNaturalCapture(input: {
  id: string;
  source: InboxSource;
  createdAt: string;
  parsed: NaturalCapture;
  accountId?: string;
  fingerprint?: string;
  confidence?: number;
}): InboxItem {
  const proposedAction: InboxProposedAction = input.parsed.kind === 'expense'
    ? 'create_expense'
    : input.parsed.kind === 'travel'
      ? 'create_travel'
      : input.parsed.kind === 'health'
        ? 'create_health'
        : 'create_schedule';
  const payload = input.parsed.kind === 'expense'
    ? { amount: input.parsed.amount, merchant: input.parsed.merchant, category: input.parsed.category, paySource: input.parsed.source, accountId: input.accountId || '', reimbursable: false }
    : input.parsed.kind === 'travel'
      ? { travelKind: input.parsed.travelKind, number: input.parsed.number, from: input.parsed.from, to: input.parsed.to, date: input.parsed.date, departTime: input.parsed.departTime, arriveTime: input.parsed.arriveTime || '' }
      : input.parsed.kind === 'health'
        ? { metric: input.parsed.metric, value: input.parsed.value }
        : { title: input.parsed.title, date: input.parsed.date, time: input.parsed.time };
  return normalizeInboxItem({
    id: input.id,
    source: input.source,
    confidence: input.confidence ?? inboxDefaultConfidence(input.source),
    proposedAction,
    payload,
    createdAt: input.createdAt,
    status: 'pending',
    fingerprint: input.fingerprint,
  }) as InboxItem;
}

export function inboxItemFromButlerAction(input: { id: string; createdAt: string; action: ButlerAction; confidence?: number }): InboxItem | null {
  return normalizeInboxItem({
    id: input.id,
    source: 'ai',
    confidence: input.confidence ?? inboxDefaultConfidence('ai'),
    proposedAction: input.action.type,
    payload: input.action.payload,
    createdAt: input.createdAt,
    status: 'pending',
  });
}

export function inboxItemFromPayment(input: {
  id: string;
  createdAt: string;
  amount?: number;
  merchant?: string;
  title?: string;
  category?: string;
  source?: string;
  accountId?: string;
  dir?: string;
  fingerprint?: string;
}): InboxItem {
  const amount = Number(input.amount ?? 0);
  const merchant = String(input.merchant || input.title || '支付成功');
  const proposedAction: InboxProposedAction = input.dir === 'in' ? 'create_income' : 'create_expense';
  return normalizeInboxItem({
    id: input.id,
    source: 'payment',
    confidence: inboxDefaultConfidence('payment'),
    proposedAction,
    payload: { amount, merchant, category: input.category || (proposedAction === 'create_income' ? '收入' : '其他'), accountId: input.accountId || '', paySource: input.source || 'Android 支付通知', reimbursable: false },
    createdAt: input.createdAt,
    status: 'pending',
    fingerprint: input.fingerprint,
  }) as InboxItem;
}

export function inboxItemFromTravelNotice(input: {
  id: string;
  createdAt: string;
  travel: {
    kind?: string;
    number?: string;
    from?: string;
    to?: string;
    departAt?: string;
    arriveAt?: string;
    seat?: string;
    terminal?: string;
    source?: string;
  };
  existing?: boolean;
}): InboxItem {
  const departAt = String(input.travel.departAt || '');
  return normalizeInboxItem({
    id: input.id,
    source: 'travel',
    confidence: inboxDefaultConfidence('travel'),
    proposedAction: input.existing ? 'update_travel' : 'create_travel',
    payload: {
      travelKind: input.travel.kind === 'flight' ? 'flight' : 'train',
      number: input.travel.number || '',
      from: input.travel.from || '待确认',
      to: input.travel.to || '待确认',
      date: departAt.slice(0, 10),
      departTime: departAt.slice(11, 16) || '08:00',
      arriveTime: String(input.travel.arriveAt || '').slice(11, 16) || '',
      departAt,
      arriveAt: input.travel.arriveAt || '',
      seat: input.travel.seat || '待分配',
      terminal: input.travel.terminal || '待确认',
      noticeSource: input.travel.source || 'notification',
    },
    createdAt: input.createdAt,
    status: 'pending',
  }) as InboxItem;
}

export const AUDIT_OUTCOMES = ['pending', 'confirmed', 'ignored', 'undone', 'failed'] as const;
export type AuditOutcome = typeof AUDIT_OUTCOMES[number];
export const AUDIT_LOG_LIMIT = 200;
export const AUDIT_OUTCOME_LABELS: Record<AuditOutcome, string> = {
  pending: '待确认',
  confirmed: '已确认',
  ignored: '已忽略',
  undone: '已撤销',
  failed: '失败',
};
export const AUDIT_REASON_LABELS: Record<string, string> = {
  missing_amount: '缺少金额',
  missing_account: '缺少账户',
  invalid_health: '健康数值无效',
  invalid_travel: '行程信息不完整',
  ledger_rejected: '无法入账',
};
const AUDIT_OUTCOME_SET = new Set<string>(AUDIT_OUTCOMES);
const AUDIT_HEALTH_METRICS = new Set(['steps', 'heartRate', 'stress', 'sleep', 'pai', 'height', 'weight']);

export type AuditEntry = {
  id: string;
  timestamp: string;
  source: InboxSource;
  action: InboxProposedAction;
  itemId: string;
  outcome: AuditOutcome;
  summary: string;
  reason?: string;
  dataScope?: string;
};

export type InboxAuditStore = {
  inboxItems: InboxItem[];
  auditLog: AuditEntry[];
};

export type InboxLifecycleEvent =
  | { type: 'enqueue'; item: InboxItem | null; timestamp: string; id?: string }
  | { type: 'confirm'; itemId: string; resultEntityId?: string; timestamp: string; id?: string }
  | { type: 'ignore'; itemId: string; timestamp: string; id?: string }
  | { type: 'undo'; itemId: string; timestamp: string; id?: string }
  | { type: 'fail'; itemId: string; reason: string; dataScope?: string; timestamp: string; id?: string };

export function auditOutcomeLabel(outcome: AuditOutcome | string): string {
  return AUDIT_OUTCOME_LABELS[outcome as AuditOutcome] || '未知状态';
}

export function auditReasonLabel(reason: string | undefined): string {
  if (!reason) return '';
  return AUDIT_REASON_LABELS[reason] || reason;
}

export function canUndoAuditEntry(_entry: AuditEntry | undefined | null): boolean {
  return false;
}

function sanitizeAuditText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  if (!text || INBOX_SECRET.test(text)) return fallback;
  return text.slice(0, 200);
}

export function normalizeAuditEntry(raw: unknown): AuditEntry | null {
  if (!inboxIsPlainObject(raw)) return null;
  const source = INBOX_SOURCE_SET.has(String(raw.source)) ? String(raw.source) as InboxSource : null;
  const action = INBOX_ACTION_SET.has(String(raw.action || raw.proposedAction)) ? String(raw.action || raw.proposedAction) as InboxProposedAction : null;
  const outcome = AUDIT_OUTCOME_SET.has(String(raw.outcome)) ? String(raw.outcome) as AuditOutcome : null;
  const itemId = sanitizeAuditText(raw.itemId);
  if (!source || !action || !outcome || !itemId) return null;
  const timestamp = sanitizeAuditText(raw.timestamp);
  const id = sanitizeAuditText(raw.id) || `audit-${timestamp || 'legacy'}-${itemId}-${outcome}`;
  const entry: AuditEntry = {
    id,
    timestamp,
    source,
    action,
    itemId,
    outcome,
    summary: sanitizeAuditText(raw.summary, inboxPreviewFor(action, {})),
  };
  const reason = sanitizeAuditText(raw.reason);
  const dataScope = sanitizeAuditText(raw.dataScope);
  if (reason) entry.reason = reason;
  if (dataScope) entry.dataScope = dataScope;
  return entry;
}

export function normalizeAuditEntries(raw: unknown): AuditEntry[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const entries: AuditEntry[] = [];
  for (const item of raw) {
    const entry = normalizeAuditEntry(item);
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    entries.push(entry);
    if (entries.length >= AUDIT_LOG_LIMIT) break;
  }
  return entries;
}

export function migrateAuditLog(raw: unknown): AuditEntry[] {
  if (Array.isArray(raw)) return normalizeAuditEntries(raw);
  if (inboxIsPlainObject(raw)) return normalizeAuditEntries(raw.auditLog);
  return [];
}

export function appendAuditEntry(entries: AuditEntry[], incoming: unknown): AuditEntry[] {
  const entry = normalizeAuditEntry(incoming);
  if (!entry) return normalizeAuditEntries(entries);
  return [entry, ...entries.filter((existing) => existing.id !== entry.id)].slice(0, AUDIT_LOG_LIMIT);
}

export function filterAuditLog(entries: AuditEntry[], filters: { outcome?: string; source?: string } = {}): AuditEntry[] {
  return entries.filter((entry) => {
    if (filters.outcome && entry.outcome !== filters.outcome) return false;
    if (filters.source && entry.source !== filters.source) return false;
    return true;
  });
}

export function inboxConfirmBlockReason(item: InboxItem, accounts: { id: string }[]): { reason: string; dataScope?: string } | null {
  if (item.proposedAction === 'create_expense' || item.proposedAction === 'create_income') {
    const amount = Math.abs(Number(item.payload.amount ?? 0));
    if (!amount) return { reason: 'missing_amount', dataScope: 'finance' };
    const accountId = String(item.payload.accountId || accounts[0]?.id || '');
    if (!accountId || !accounts.some((account) => account.id === accountId)) return { reason: 'missing_account', dataScope: 'finance' };
    return null;
  }
  if (item.proposedAction === 'create_health') {
    const value = Number(item.payload.value);
    const metric = String(item.payload.metric || '');
    if (!(value > 0) || !AUDIT_HEALTH_METRICS.has(metric)) return { reason: 'invalid_health', dataScope: 'health' };
    return null;
  }
  if (item.proposedAction === 'create_travel' || item.proposedAction === 'update_travel') {
    if (!item.payload.number || !item.payload.from || !item.payload.to) return { reason: 'invalid_travel', dataScope: 'travel' };
  }
  return null;
}

function auditEntryFromInbox(item: InboxItem, input: { id?: string; timestamp: string; outcome: AuditOutcome; reason?: string; dataScope?: string }): AuditEntry | null {
  return normalizeAuditEntry({
    id: input.id,
    timestamp: input.timestamp,
    source: item.source,
    action: item.proposedAction,
    itemId: item.id,
    outcome: input.outcome,
    summary: item.preview,
    reason: input.reason,
    dataScope: input.dataScope,
  });
}

export function applyInboxLifecycle(store: InboxAuditStore, event: InboxLifecycleEvent): InboxAuditStore {
  if (event.type === 'enqueue') {
    const incoming = event.item ? normalizeInboxItem(event.item) : null;
    if (!incoming) return store;
    const merged = store.inboxItems.find((item) => item.status === 'pending' && item.dedupeKey === incoming.dedupeKey);
    const inboxItems = enqueueInboxItem(store.inboxItems, incoming);
    if (merged) return { inboxItems, auditLog: store.auditLog };
    const entry = auditEntryFromInbox(incoming, { id: event.id, timestamp: event.timestamp, outcome: 'pending' });
    return { inboxItems, auditLog: entry ? appendAuditEntry(store.auditLog, entry) : store.auditLog };
  }
  if (event.type === 'confirm') {
    const item = store.inboxItems.find((entry) => entry.id === event.itemId && entry.status === 'pending');
    if (!item) return store;
    const inboxItems = confirmInboxItem(store.inboxItems, event.itemId, event.resultEntityId);
    const confirmed = inboxItems.find((entry) => entry.id === event.itemId) || item;
    const entry = auditEntryFromInbox(confirmed, { id: event.id, timestamp: event.timestamp, outcome: 'confirmed' });
    return { inboxItems, auditLog: entry ? appendAuditEntry(store.auditLog, entry) : store.auditLog };
  }
  if (event.type === 'ignore') {
    const item = store.inboxItems.find((entry) => entry.id === event.itemId && entry.status === 'pending');
    if (!item) return store;
    const inboxItems = ignoreInboxItem(store.inboxItems, event.itemId);
    const entry = auditEntryFromInbox(item, { id: event.id, timestamp: event.timestamp, outcome: 'ignored' });
    return { inboxItems, auditLog: entry ? appendAuditEntry(store.auditLog, entry) : store.auditLog };
  }
  if (event.type === 'undo') {
    const item = store.inboxItems.find((entry) => entry.id === event.itemId && entry.status === 'confirmed');
    if (!item) return store;
    const inboxItems = reopenInboxItem(store.inboxItems, event.itemId);
    const entry = auditEntryFromInbox(item, { id: event.id, timestamp: event.timestamp, outcome: 'undone' });
    return { inboxItems, auditLog: entry ? appendAuditEntry(store.auditLog, entry) : store.auditLog };
  }
  const item = store.inboxItems.find((entry) => entry.id === event.itemId);
  if (!item) return store;
  const entry = auditEntryFromInbox(item, {
    id: event.id,
    timestamp: event.timestamp,
    outcome: 'failed',
    reason: event.reason,
    dataScope: event.dataScope,
  });
  return { inboxItems: store.inboxItems, auditLog: entry ? appendAuditEntry(store.auditLog, entry) : store.auditLog };
}

export type PermissionOnboardingState = {
  version: 2;
  dismissed: boolean;
  completedAt: string | null;
  settingsOpened: boolean;
};

export function normalizePermissionOnboarding(raw: unknown): PermissionOnboardingState {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  return {
    version: 2,
    dismissed: source.dismissed === true,
    completedAt: typeof source.completedAt === 'string' ? source.completedAt : null,
    settingsOpened: source.settingsOpened === true,
  };
}

export type PermissionCardId = 'payment' | 'reminders' | 'health' | 'autofill';

export type PermissionOnboardingCard = {
  id: PermissionCardId;
  title: string;
  why: string;
  reads: string;
  cannotRead: string;
};

export type CapabilityStatusSnapshot = {
  accessibility?: boolean | null;
  notifications?: boolean | null;
  notificationListener?: boolean | null;
  autofill?: boolean | null;
  exactAlarms?: boolean | null;
  fullScreenIntent?: boolean | null;
  healthConnect?: boolean | null;
};

export function shouldShowPermissionOnboarding(state: unknown, options?: { reopen?: boolean }): boolean {
  if (options?.reopen) return true;
  return !normalizePermissionOnboarding(state).dismissed;
}

export function permissionOnboardingCards(): PermissionOnboardingCard[] {
  return [
    {
      id: 'payment',
      title: '支付识别',
      why: '识别微信、支付宝付款成功，生成待确认的入账草稿。',
      reads: '无障碍里的支付成功页，以及通知使用权中的微信、支付宝、云闪付支付通知。',
      cannotRead: '不读聊天、通讯录、验证码和密码页，也不会自动点击。',
    },
    {
      id: 'reminders',
      title: '日程提醒',
      why: '到点弹出日程和每月账单提醒，即使应用在后台。',
      reads: '本机已保存的日程标题、时间和账单名称。',
      cannotRead: '不靠读取其他应用通知来提醒，也不改系统日历。',
    },
    {
      id: 'health',
      title: '健康同步',
      why: '从你授权的健康导出或 Health Connect 导入身高、体重、心率、睡眠等摘要。',
      reads: 'Gadgetbridge 导出文件或 Health Connect 近几日摘要。',
      cannotRead: '不登录厂商账号，不上传健康数据，也不当作诊断。',
    },
    {
      id: 'autofill',
      title: '密码自动填充',
      why: '在其他应用登录时，由系统保存和填充账号密码。',
      reads: '系统自动填充框架提供的账号字段。',
      cannotRead: '密码明文不进网页、备份和 AI；查看需指纹或锁屏。',
    },
  ];
}

function detectableEnabled(...flags: Array<boolean | null | undefined>): boolean {
  const detected = flags.filter((flag): flag is boolean => flag === true || flag === false);
  return detected.length > 0 && detected.every(Boolean);
}

export function permissionOnboardingProgress(
  caps: CapabilityStatusSnapshot = {},
  _onboarding?: Partial<PermissionOnboardingState> | { settingsOpened?: boolean },
): Array<PermissionOnboardingCard & { enabled: boolean }> {
  void _onboarding;
  const cards = permissionOnboardingCards();
  return cards.map((card) => {
    if (card.id === 'payment') return { ...card, enabled: detectableEnabled(caps.notificationListener, caps.accessibility) };
    if (card.id === 'reminders') return { ...card, enabled: detectableEnabled(caps.notifications, caps.exactAlarms, caps.fullScreenIntent) };
    if (card.id === 'health') return { ...card, enabled: detectableEnabled(caps.healthConnect) };
    return { ...card, enabled: detectableEnabled(caps.autofill) };
  });
}

export function parseCapabilityStatus(raw: unknown): CapabilityStatusSnapshot {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const optional = (key: string): boolean | null => (source[key] === true ? true : source[key] === false ? false : null);
  return {
    accessibility: source.accessibility === true,
    notifications: source.notifications === true,
    notificationListener: source.notificationListener === true,
    autofill: source.autofill === true,
    exactAlarms: optional('exactAlarms'),
    fullScreenIntent: optional('fullScreenIntent'),
    healthConnect: optional('healthConnect'),
  };
}

export function dismissPermissionOnboarding(state: unknown, completedAt: string): PermissionOnboardingState {
  return { ...normalizePermissionOnboarding(state), dismissed: true, completedAt };
}

export function markPermissionSettingsOpened(state: unknown): PermissionOnboardingState {
  return { ...normalizePermissionOnboarding(state), settingsOpened: true };
}

export const TOAST_ARIA_LIVE = 'polite' as const;
export function dialogShouldDismiss(key: string): boolean {
  return key === 'Escape';
}

const REDACTED = '[REDACTED]';
const SENSITIVE_PATTERNS: RegExp[] = [
  /(?:密码|口令|password|passwd)\s*[:=是为]?\s*\S+/gi,
  /(?:api[_-]?key|API密钥)\s*[:=是为]?\s*\S+/gi,
  /\bsk-[A-Za-z0-9_-]{8,}\b/gi,
  /(?:token|令牌)\s*[:=是为]?\s*\S+/gi,
  /\bghp_[A-Za-z0-9]{16,}\b/gi,
  /(?:验证码|otp|one[-\s]?time(?:\s*password)?)\s*[:=是为]?\s*\d{4,8}/gi,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi,
  /私钥(?:\s+BEGIN PRIVATE KEY)?/gi,
  /BEGIN PRIVATE KEY/gi,
  /助记词[\s\S]{0,120}/gi,
  /(?:mnemonic|seed phrase)\s*[:=]?\s*(?:[a-z]+(?:\s+|$)){8,24}/gi,
  /\b(?:\d[ -]*?){13,19}\b/g,
];

export function redactSensitiveText(text: string): { text: string; blocked: boolean } {
  let next = String(text || '');
  let blocked = false;
  for (const pattern of SENSITIVE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(next)) {
      blocked = true;
      pattern.lastIndex = 0;
      next = next.replace(pattern, REDACTED);
    }
  }
  return { text: next, blocked };
}

export function sanitizeModelBoundFields(value: unknown): unknown {
  if (typeof value === 'string') return redactSensitiveText(value).text;
  if (Array.isArray(value)) return value.map(sanitizeModelBoundFields);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SECRET_FIELD.test(key) ? REDACTED : sanitizeModelBoundFields(nested);
    }
    return out;
  }
  return value;
}

export function prepareOutboundAiPayload(input: { userMessage: string; fields?: Record<string, string> }): {
  ok: boolean;
  blocked: boolean;
  messages?: { role: 'system' | 'user'; content: string }[];
} {
  const user = redactSensitiveText(input.userMessage);
  const fields = Object.fromEntries(Object.entries(input.fields || {}).map(([key, value]) => {
    const redacted = redactSensitiveText(String(value));
    return [key, redacted];
  }));
  const blocked = user.blocked || Object.values(fields).some((item) => item.blocked);
  if (blocked) return { ok: false, blocked: true };
  const system = fields.system?.text;
  return {
    ok: true,
    blocked: false,
    messages: [
      ...(system ? [{ role: 'system' as const, content: system }] : []),
      { role: 'user', content: user.text },
    ],
  };
}

export type AiSendPreviewField = { key: string; label: string; included: boolean; valueShown: false };
export type AiSendPreview = { domain: string; fields: AiSendPreviewField[] };

export function byokHostOf(raw: string): string {
  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return url.hostname.replace(/^\[|\]$/g, '');
  } catch {
    return '';
  }
}

export function confirmByokHost(baseUrl: string, confirmedHost: string): boolean {
  const host = byokHostOf(baseUrl);
  return Boolean(host) && host === confirmedHost.trim();
}

export function buildAiSendPreview(input: { privacy: PrivacyFlags; memories?: { sendAllowed?: boolean }[]; baseUrl: string }): AiSendPreview {
  const scopes = describeButlerDataScope(input.privacy);
  return {
    domain: byokHostOf(input.baseUrl),
    fields: scopes.map((item) => ({ key: item.key, label: item.label, included: item.allowed, valueShown: false })),
  };
}

export const AI_SUPPORTED_TOOLS = ['read_finance_summary', 'draft_expense', 'draft_schedule', 'draft_memory_change'] as const;
export type AiSupportedTool = typeof AI_SUPPORTED_TOOLS[number];

export type AiToolCall =
  | { name: 'read_finance_summary'; arguments: Record<string, never> }
  | { name: 'draft_expense'; arguments: { amount: number; merchant: string; accountId: string; currency: string; date: string; reimbursable: boolean | null } }
  | { name: 'draft_schedule'; arguments: { title: string; date: string; time: string } }
  | { name: 'draft_memory_change'; arguments: { op: 'add' | 'update' | 'pause' | 'delete'; id?: string; title?: string; note?: string } };

export type AiProviderResponse = { reply: string; tools: AiToolCall[]; mutatesState: false };

function parseToolArguments(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isPlainObject(raw) ? raw : null;
}

function validateAiToolCall(value: unknown): AiToolCall | null {
  if (!isPlainObject(value)) return null;
  const name = String(value.name || value.type || '');
  const args = parseToolArguments(value.arguments ?? value.payload ?? value.args) || {};
  if (hasSecretFields(args)) return null;
  if (name === 'read_finance_summary') return { name, arguments: {} };
  if (name === 'draft_expense') {
    if (!('amount' in args) || !('merchant' in args) || !('accountId' in args) || !('currency' in args) || !('date' in args) || !('reimbursable' in args)) return null;
    const amount = Number(args.amount);
    const merchant = requiredString(args.merchant);
    if (!(amount > 0) || !merchant) return null;
    const reimbursable = args.reimbursable === true ? true : args.reimbursable === false ? false : null;
    return {
      name,
      arguments: {
        amount,
        merchant,
        accountId: args.accountId == null ? '' : String(args.accountId),
        currency: args.currency == null ? '' : String(args.currency),
        date: args.date == null ? '' : String(args.date),
        reimbursable,
      },
    };
  }
  if (name === 'draft_schedule') {
    const title = requiredString(args.title);
    const date = requiredString(args.date);
    const time = requiredString(args.time);
    if (!title || !date || !time || !DATE_RE.test(date) || !TIME_RE.test(time)) return null;
    return { name, arguments: { title, date, time } };
  }
  if (name === 'draft_memory_change') {
    const op = args.op === 'add' || args.op === 'update' || args.op === 'pause' || args.op === 'delete' ? args.op : null;
    if (!op) return null;
    if (op === 'add') {
      const title = requiredString(args.title);
      if (!title) return null;
      return { name, arguments: { op, title, note: requiredString(args.note) || undefined } };
    }
    const id = requiredString(args.id);
    if (!id) return null;
    return { name, arguments: { op, id, title: requiredString(args.title) || undefined, note: requiredString(args.note) || undefined } };
  }
  return null;
}

function collectToolCandidates(parsed: Record<string, unknown>): unknown[] {
  if (Array.isArray(parsed.tool_calls)) return parsed.tool_calls;
  if (Array.isArray(parsed.tools)) return parsed.tools;
  if (parsed.function_call) return [parsed.function_call];
  if (Array.isArray(parsed.actions)) {
    return parsed.actions.map((action) => {
      if (!isPlainObject(action)) return action;
      const type = String(action.type || '');
      if (type === 'create_expense') return { name: 'draft_expense', arguments: action.payload };
      if (type === 'create_schedule') return { name: 'draft_schedule', arguments: action.payload };
      if (type === 'add_memory' || type === 'update_memory' || type === 'pause_memory' || type === 'delete_memory') {
        const op = type === 'add_memory' ? 'add' : type === 'update_memory' ? 'update' : type === 'pause_memory' ? 'pause' : 'delete';
        return { name: 'draft_memory_change', arguments: { op, ...(isPlainObject(action.payload) ? action.payload : {}) } };
      }
      return action;
    });
  }
  return [];
}

export function parseAiProviderResponse(raw: unknown): AiProviderResponse {
  const parsed = typeof raw === 'string' ? extractJsonObject(raw) : isPlainObject(raw) ? raw : null;
  if (!parsed) return { reply: typeof raw === 'string' ? raw.trim() : '', tools: [], mutatesState: false };
  const reply = typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : '';
  const tools = collectToolCandidates(parsed).map(validateAiToolCall).filter((item): item is AiToolCall => Boolean(item));
  return { reply, tools, mutatesState: false };
}

export function inboxItemFromAiTool(input: { id: string; createdAt: string; tool: AiToolCall; confidence?: number }): InboxItem | null {
  if (input.tool.name === 'read_finance_summary') return null;
  if (input.tool.name === 'draft_expense') {
    const args = input.tool.arguments;
    return inboxItemFromButlerAction({
      id: input.id,
      createdAt: input.createdAt,
      action: {
        type: 'create_expense',
        payload: {
          amount: args.amount,
          merchant: args.merchant,
          accountId: args.accountId,
          currency: args.currency,
          date: args.date,
          reimbursable: args.reimbursable === true ? true : args.reimbursable === false ? false : undefined,
        },
      },
      confidence: input.confidence,
    });
  }
  if (input.tool.name === 'draft_schedule') {
    return inboxItemFromButlerAction({
      id: input.id,
      createdAt: input.createdAt,
      action: { type: 'create_schedule', payload: input.tool.arguments },
      confidence: input.confidence,
    });
  }
  const change = input.tool.arguments;
  const action: ButlerAction = change.op === 'add'
    ? { type: 'add_memory', payload: { title: change.title || '', note: change.note } }
    : change.op === 'update'
      ? { type: 'update_memory', payload: { id: change.id || '', title: change.title, note: change.note } }
      : change.op === 'pause'
        ? { type: 'pause_memory', payload: { id: change.id || '' } }
        : { type: 'delete_memory', payload: { id: change.id || '' } };
  return inboxItemFromButlerAction({ id: input.id, createdAt: input.createdAt, action, confidence: input.confidence });
}

function isPrivateOrLocalHost(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (!h || h === 'localhost' || h.endsWith('.localhost') || h === '::1') return true;
  if (h.includes(':') && (h.startsWith('fe80:') || h.startsWith('fc') || h.startsWith('fd'))) return true;
  const parts = h.split('.');
  if (parts.length === 4 && parts.every((part) => /^\d+$/.test(part))) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  return false;
}

export function validateByokTarget(raw: string): { ok: boolean; host: string; reason?: string } {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return { ok: false, host: url.hostname, reason: 'https_only' };
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (isPrivateOrLocalHost(host)) return { ok: false, host, reason: 'private_or_local' };
    return { ok: true, host };
  } catch {
    return { ok: false, host: '', reason: 'invalid' };
  }
}

export type CallBudget = { maxCalls: number; maxTokens: number; timeoutMs: number; remainingCalls: number; remainingTokens: number };

export function createCallBudget(input: { maxCalls: number; maxTokens: number; timeoutMs: number }): CallBudget {
  return { ...input, remainingCalls: input.maxCalls, remainingTokens: input.maxTokens };
}

export function consumeCallBudget(budget: CallBudget, tokens: number): { ok: boolean; budget: CallBudget } {
  if (budget.remainingCalls < 1 || tokens > budget.remainingTokens) return { ok: false, budget };
  budget.remainingCalls -= 1;
  budget.remainingTokens -= tokens;
  return { ok: true, budget };
}

export function unusualRedirect(_from: string, _to: string): boolean {
  return true;
}
export {
  ACCOUNT_TYPES,
  FINANCE_TABS,
  applyPostings,
  buildReimbursementSettlement,
  canDeleteAccount,
  composeTransactionPostings,
  derivedAccountBalance,
  financeTransactionFields,
  investmentAccountSnapshot,
  isMonthlyIncome,
  migrateInvestmentCash,
  migrateSubscriptionAccounts,
  migrateToPostingLedger,
  monthlyIncomeTotal,
  normalizeFinanceRecords,
  postBalanceAdjustment,
  postFinanceTransaction,
  refreshHoldingsValuation,
  reimbursementOutstandingAmount,
  removePostedTransaction,
  resolveTransferAmounts,
  runFinanceInvariantSequence,
  settlePostedReimbursement,
} from './finance-core';
