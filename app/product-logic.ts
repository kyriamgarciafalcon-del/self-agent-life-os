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

type ScopedSummaryInput = {
  today: string;
  month: string;
  privacy: { schedule: boolean; finance: boolean; health: boolean };
  schedules: { date: string; done: boolean; title: string }[];
  transactions: { createdAt: string }[];
  healthRecords: HealthMetricRecord[];
  memories: { active: boolean; title: string; note: string; source?: string; purpose?: string; updatedAt?: string }[];
};

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
  const schedule = input.privacy.schedule
    ? `日程未完成=${input.schedules.filter((item) => item.date === input.today && !item.done).map((item) => item.title).join('、') || '无'}`
    : '日程权限关闭';
  const finance = input.privacy.finance
    ? `本月流水 ${input.transactions.filter((item) => item.createdAt.startsWith(input.month)).length} 笔`
    : '财务权限关闭';
  const health = input.privacy.health ? summarizeHealth(input.healthRecords) : '健康权限关闭';
  const memories = input.memories.filter((item) => item.active).map((item) => `${item.title}（${item.note}）`).join('；') || '无';
  return `你是 Self Agent 本机管家。只能使用这些摘要：${schedule}；${finance}；${health}；用户允许的记忆=${memories}。禁止索取或输出密码、验证码、私钥、助记词、完整卡号。健康不是诊断，财务不是投资建议。`;
}

export type MemoryStatus = '使用中' | '已暂停';
export type MemoryRecord = {
  id: string;
  kind: string;
  title: string;
  note: string;
  active: boolean;
  status: MemoryStatus;
  source: string;
  purpose: string;
  updatedAt: string;
};

export function normalizeMemory(raw: Partial<MemoryRecord> & { id?: string; title?: string; note?: string; active?: boolean }): MemoryRecord {
  const note = String(raw.note || '');
  const active = raw.active !== false;
  return {
    id: String(raw.id || ''),
    kind: String(raw.kind || '观察'),
    title: String(raw.title || '未命名记忆'),
    note,
    active,
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
  | { type: 'create_expense'; payload: { amount: number; merchant: string; category?: string; source?: string } }
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
    return { type, payload: { amount, merchant, category: requiredString(payload.category) || undefined, source: requiredString(payload.source) || undefined } };
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

export function describeButlerDataScope(privacy: { schedule: boolean; finance: boolean; health: boolean }) {
  return [
    { key: 'schedule', label: '日程', allowed: privacy.schedule },
    { key: 'finance', label: '财务', allowed: privacy.finance },
    { key: 'health', label: '健康', allowed: privacy.health },
    { key: 'vault', label: '密码', allowed: false },
  ] as const;
}

export function buildButlerSystemPrompt(input: ScopedSummaryInput & { vaultItems?: unknown }): string {
  const briefing = buildHealthBriefing(input.healthRecords, input.privacy.health);
  const healthLine = input.privacy.health
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
  const optionalArrays = ['recurringRules', 'healthRecords', 'travels', 'investments', 'memories', 'vaultItems'];
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

export function wealthTotals(accounts: WealthAccount[], transactions: WealthTxn[] = []): WealthLine[] {
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

export function cnyWealthTotal(accounts: WealthAccount[], transactions: WealthTxn[] = [], rates: ExchangeRate[] = []): CnyWealthTotal {
  const ratesByCurrency = new Map(rates.filter((rate) => Number.isFinite(rate.cnyRate) && rate.cnyRate > 0 && validRateDate(rate.asOf) && Number.isFinite(Date.parse(rate.updatedAt))).map((rate) => [rate.currency, rate]));
  let convertedCny = 0;
  const unresolved = new Map<string, number>();
  for (const line of wealthTotals(accounts, transactions)) {
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
  kind: 'expense' | 'income' | 'transfer';
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
    if (transaction.kind === 'transfer') return debt ? amount : -amount;
  }
  if (transaction.kind === 'expense' && transaction.reimbursable && !transaction.reimbursed && account.id === transaction.reimburseAccountId && role === 'receivable') {
    return amount;
  }
  if (transaction.kind === 'transfer' && account.id === transaction.targetAccountId) {
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
  let nextAccounts = applyLedger(accounts, linkedCredit, 1);
  const claim = accounts.find((account) => account.id === original.reimburseAccountId);
  if (claim && accountRole(claim.type) === 'receivable') {
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
