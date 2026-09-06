import { useState } from 'react';
import {
  getConvertedNetWorth,
  getMonthlyReport,
  getNetWorth,
  getOutstandingReimbursements,
  transactionsInPeriod,
} from '../../finance-query';
import { accountRole, investmentAccountSnapshot, isDebtRole, localDateKey, normalizeAccountBalance } from '../../product-logic';
import { currencyMark, formatAssetAmount, holdingKindLabel, investmentProfit, investmentValue, money, roleLabel } from './format';
import { FINANCE_CURRENCIES, FINANCE_SECTIONS, type Account, type Currency, type FinanceData, type FinanceSection, type InvestmentHolding, type Transaction } from './types';
import './finance.css';

const TODAY = localDateKey();
const MONTH = TODAY.slice(0, 7);

export type FinancePageProps = {
  data: FinanceData;
  currency: Currency;
  selectedAccountId: string | null;
  selectedHoldingId: string | null;
  onCurrency: (currency: Currency) => void;
  onSelectAccount: (id: string) => void;
  onSelectHolding: (id: string) => void;
  onBackAccount: () => void;
  onBackHolding: () => void;
  onNewTransaction: () => void;
  onEditTransaction: (id: string) => void;
  onDeleteTransaction: (id: string) => void;
  onNewAccount: () => void;
  onEditAccount: (id: string) => void;
  onNewHolding: () => void;
  onEditHolding: (id: string) => void;
  onNewRecurring: () => void;
  onEditRecurring: (id: string) => void;
  onDeleteRecurring: (id: string) => void;
  onRunRecurring: (id: string) => void;
  onSettleReimbursement: (id: string) => void;
  onSettleAccount: (id: string) => void;
  onNewRate: () => void;
  onEditRate: (currency: string) => void;
  onDeleteRate: (currency: string) => void;
  onRefreshQuotes: () => void;
};

export function FinancePage({
  data,
  currency,
  selectedAccountId,
  selectedHoldingId,
  onCurrency,
  onSelectAccount,
  onSelectHolding,
  onBackAccount,
  onBackHolding,
  onNewTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onNewAccount,
  onEditAccount,
  onNewHolding,
  onEditHolding,
  onNewRecurring,
  onEditRecurring,
  onDeleteRecurring,
  onRunRecurring,
  onSettleReimbursement,
  onSettleAccount,
  onNewRate,
  onEditRate,
  onDeleteRate,
  onRefreshQuotes,
}: FinancePageProps) {
  const [financeSection, setFinanceSection] = useState<FinanceSection>('总览');
  const selectedHolding = selectedHoldingId ? data.investments.find((item) => item.id === selectedHoldingId) : undefined;
  if (selectedHolding) {
    return <HoldingDetail holding={selectedHolding} account={data.accounts.find((item) => item.id === selectedHolding.accountId)} onBack={onBackHolding} onEdit={() => onEditHolding(selectedHolding.id)} />;
  }

  const selectedAccount = selectedAccountId ? data.accounts.find((item) => item.id === selectedAccountId) : undefined;
  if (selectedAccount) {
    return (
      <AccountDetail
        account={selectedAccount}
        data={data}
        onBack={onBackAccount}
        onEdit={() => onEditAccount(selectedAccount.id)}
        onSettle={() => onSettleAccount(selectedAccount.id)}
        onNewHolding={onNewHolding}
        onSelectHolding={onSelectHolding}
        onNewTransaction={onNewTransaction}
        onEditTransaction={onEditTransaction}
        onDeleteTransaction={onDeleteTransaction}
        onSettleReimbursement={onSettleReimbursement}
      />
    );
  }

  const monthItems = transactionsInPeriod(data.transactions, MONTH).filter((item) => item.currency === currency);
  const monthSummary = getMonthlyReport(monthItems, currency);
  const todayExpense = getMonthlyReport(transactionsInPeriod(monthItems, TODAY), currency).expense;
  const reimburse = getOutstandingReimbursements(data.transactions, currency);
  const currentDay = Number(TODAY.slice(-2));
  const chartDays = Array.from({ length: Math.min(6, currentDay) }, (_, index) => Math.max(1, currentDay - 5) + index).map((day) => ({
    day,
    amount: getMonthlyReport(transactionsInPeriod(monthItems, `${MONTH}-${String(day).padStart(2, '0')}`), currency).expense,
  }));
  const maxDay = Math.max(...chartDays.map((item) => item.amount), 1);
  const mark = currencyMark(currency);
  const wealth = getNetWorth(data.accounts, data.transactions, data.investments);
  const cnyWealth = getConvertedNetWorth(data.accounts, data.transactions, data.exchangeRates, data.investments);
  const hasDailyFx = data.exchangeRates.some((rate) => rate.source === 'daily');

  return (
    <div className="page sa-page finance-page">
      <header className="sa-page-header">
        <h1>财务</h1>
        <p>{Number(MONTH.slice(0, 4))}年{Number(MONTH.slice(5, 7))}月 · 统一账本</p>
        <div className="finance-toolbar-row">
          <select aria-label="月度收支币种" value={currency} onChange={(event) => onCurrency(event.target.value as Currency)}>
            {FINANCE_CURRENCIES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
      </header>

      <nav className="finance-tabs" role="tablist" aria-label="财务分类">
        {FINANCE_SECTIONS.map((section) => (
          <button key={section} type="button" role="tab" aria-selected={financeSection === section} className={financeSection === section ? 'active' : ''} onClick={() => setFinanceSection(section)}>
            {section}
          </button>
        ))}
      </nav>

      <div className="finance-tab-panel" role="tabpanel" hidden={financeSection !== '总览'}>
        <div className="sa-card finance-networth">
          <p className="sa-group-header" style={{ margin: 0, padding: 0 }}>净资产</p>
          <strong>¥ {money(cnyWealth.convertedCny)}</strong>
          {cnyWealth.unresolved.length > 0 && (
            <p style={{ margin: '8px 0 0' }}>待补汇率，暂未计入：{cnyWealth.unresolved.map((item) => `${item.currency} ${money(item.amount)}`).join(' · ')}</p>
          )}
          {wealth.map((line) => (
            <p key={`${line.currency}-break`} style={{ margin: '8px 0 0' }}>
              {line.currency} 资产 {formatAssetAmount(line.currency, line.assets)} · 债务 · 应收 {formatAssetAmount(line.currency, line.receivable)} · 债务 · 应付 {formatAssetAmount(line.currency, line.payable)}
            </p>
          ))}
          <p style={{ margin: '8px 0 0' }}>
            {data.accounts.length
              ? '外币按每日参考汇率折算人民币；缺失汇率的币种不伪造总额。债务里有应收和应付，报销不是独立账户。'
              : '还没有账户，净资产为 ¥ 0.00。'}
          </p>
          {!data.accounts.length && <div className="account-hero-ops"><button type="button" onClick={onNewAccount}>添加第一个账户</button></div>}
        </div>

        <p className="sa-group-header">人民币汇率</p>
        <div className="sa-group">
          <div className="sa-row">
            <span className="sa-row-text"><strong>参考汇率</strong><small>每天 18:00 更新一次，只改估值，不改流水。</small></span>
            <div className="row-ops">
              {!hasDailyFx && <button type="button" className="edit" onClick={onNewRate}>手动汇率</button>}
              <button type="button" className="edit" onClick={onRefreshQuotes}>每日更新</button>
            </div>
          </div>
          {data.exchangeRates.length ? data.exchangeRates.map((rate) => (
            <div className="sa-row" key={rate.currency}>
              <span className="sa-row-text">
                <strong>1 {rate.currency} = ¥ {money(rate.cnyRate)}</strong>
                <small>{rate.source === 'daily' ? '每日参考 · Frankfurter' : '手动确认'} · 适用 {rate.asOf}</small>
              </span>
              <div className="row-ops">
                <button type="button" className="edit" onClick={() => onEditRate(rate.currency)}>编辑</button>
                <button type="button" className="del" onClick={() => onDeleteRate(rate.currency)}>删除</button>
              </div>
            </div>
          )) : <div className="sa-row"><span className="sa-row-text"><strong>还没有网络汇率</strong><small>点「每日更新」，或手动补充。</small></span></div>}
        </div>

        <div className="finance-month-grid">
          <article><span>本月收入</span><strong className="income">+{mark}{money(monthSummary.income)}</strong></article>
          <article><span>本月支出</span><strong>−{mark}{money(monthSummary.expense)}</strong></article>
          <article>
            <span>本月结余</span>
            <strong className={monthSummary.balance >= 0 ? 'income' : ''}>
              {monthSummary.balance >= 0 ? '+' : '−'}{mark}{money(Math.abs(monthSummary.balance))}
            </strong>
          </article>
        </div>

        <div className="sa-card">
          <p className="sa-group-header" style={{ margin: 0, padding: 0 }}>每日支出</p>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <span style={{ color: '#8E8E93', fontSize: 13 }}>今天</span>
            <strong>{mark}{money(todayExpense)}</strong>
          </div>
          <div className="finance-spend">
            {chartDays.map((item) => (
              <div key={item.day}>
                <span><i style={{ height: `${Math.max(5, item.amount / maxDay * 100)}%` }} /></span>
                <small>{item.day}日</small>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
            <span style={{ color: '#8E8E93', fontSize: 13 }}>待报销</span>
            <strong>{mark}{money(reimburse)}</strong>
          </div>
        </div>
      </div>

      <section className="account-section" role="tabpanel" hidden={financeSection !== '账户'}>
        <p className="sa-group-header">我的账户</p>
        {data.accounts.length ? (
          <div className="sa-group">
            {data.accounts.map((account) => {
              const snap = account.type === '理财账户' ? investmentAccountSnapshot(account, data.investments) : null;
              const shown = snap ? snap.total : normalizeAccountBalance(account.type, account.balance);
              return (
                <div className="sa-row" key={account.id}>
                  <span className="sa-row-text">
                    <strong>{account.name}</strong>
                    <small>
                      {roleLabel(account.type)} · {account.currency}
                      {snap ? ` · 现金 ${currencyMark(account.currency)}${money(snap.cash)} · 市值 ${currencyMark(account.currency)}${money(snap.marketValue)}` : ''}
                    </small>
                  </span>
                  <strong className="finance-account-balance">
                    {isDebtRole(accountRole(account.type)) ? '欠 ' : ''}{currencyMark(account.currency)} {money(shown)}
                  </strong>
                  <div className="row-ops">
                    <button type="button" className="edit" aria-label={`编辑 ${account.name}`} onClick={() => onEditAccount(account.id)}>编辑</button>
                    <button type="button" className="edit" aria-label={`查看 ${account.name} 的账单`} onClick={() => onSelectAccount(account.id)}>查看账单</button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="finance-empty">还没有账户，净资产为 0</div>
        )}
        <div className="account-hero-ops" style={{ margin: '12px 16px 0' }}>
          <button type="button" onClick={onNewAccount}>添加账户</button>
        </div>
      </section>

      <section className="finance-legacy-block investment-section" role="tabpanel" hidden={financeSection !== '投资'}>
        <div className="section-title">
          <h2>理财与投资 · {currency}</h2>
          <button type="button" onClick={onNewHolding}>添加产品</button>
        </div>
        <p className="sa-page-footer" style={{ margin: '0 0 12px' }}>每天 18:00 用收盘价重算收益，账户现金由流水产生，持仓市值单独估值</p>
        <InvestmentList items={data.investments.filter((item) => item.currency === currency)} onSelect={onSelectHolding} />
        <p className="sa-page-footer">行情只覆盖今日价格点。历史流水和成本不变。</p>
      </section>

      <section className="finance-legacy-block" role="tabpanel" hidden={financeSection !== '周期账单'}>
        <div className="section-title">
          <h2>每月账单</h2>
          <button type="button" onClick={onNewRecurring}>添加账单</button>
        </div>
        <div className="recurring-list">
          {data.recurringRules.length ? data.recurringRules.map((rule) => {
            const future = rule.dueDay > Number(TODAY.slice(-2));
            return (
              <article key={rule.id} className={!rule.enabled ? 'disabled' : ''}>
                <span className="rule-icon">{rule.kind === 'subscription' ? '订' : '还'}</span>
                <div>
                  <strong>{rule.name}</strong>
                  <small>每月 {rule.dueDay} 日 · {data.accounts.find((account) => account.id === rule.accountId)?.name || '账户待补充'}</small>
                  <button type="button" disabled={!rule.enabled || rule.lastRunPeriod === MONTH || future} onClick={() => onRunRecurring(rule.id)}>
                    {rule.lastRunPeriod === MONTH ? '本月已确认' : !rule.enabled ? '已暂停' : future ? `${rule.dueDay}日到期` : rule.kind === 'subscription' ? '生成扣款草稿' : '生成还款草稿'}
                  </button>
                </div>
                <b>{currencyMark(rule.currency)}{money(rule.amount)}</b>
                <div className="row-ops">
                  <button type="button" className="edit" onClick={() => onEditRecurring(rule.id)}>编辑</button>
                  <button type="button" className="del" onClick={() => onDeleteRecurring(rule.id)}>删除</button>
                </div>
              </article>
            );
          }) : <div className="list-empty">还没有每月账单</div>}
        </div>
        <p className="sa-page-footer">只做本机到期提醒，不会替你扣款。你确认实际发生后，才会写入账本并改变余额。</p>
      </section>

      <section className="finance-legacy-block" role="tabpanel" hidden={financeSection !== '流水'}>
        <div className="section-title"><h2>本月流水 · {currency}</h2></div>
        <TransactionList items={monthItems} accounts={data.accounts} onEdit={onEditTransaction} onDelete={onDeleteTransaction} onSettle={onSettleReimbursement} />
      </section>
    </div>
  );
}

function AccountDetail({
  account,
  data,
  onBack,
  onEdit,
  onSettle,
  onNewHolding,
  onSelectHolding,
  onNewTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onSettleReimbursement,
}: {
  account: Account;
  data: FinanceData;
  onBack: () => void;
  onEdit: () => void;
  onSettle: () => void;
  onNewHolding: () => void;
  onSelectHolding: (id: string) => void;
  onNewTransaction: () => void;
  onEditTransaction: (id: string) => void;
  onDeleteTransaction: (id: string) => void;
  onSettleReimbursement: (id: string) => void;
}) {
  const accountItems = data.transactions.filter((item) => item.accountId === account.id || item.targetAccountId === account.id || item.postings?.some((posting) => posting.accountId === account.id));
  const accountHoldings = data.investments.filter((item) => item.accountId === account.id);
  const { income, expense } = getMonthlyReport(accountItems.filter((item) => item.accountId === account.id), account.currency);
  const investSnap = account.type === '理财账户' ? investmentAccountSnapshot(account, data.investments) : null;
  const role = accountRole(account.type);
  return (
    <div className="page sa-page finance-page account-detail-page">
      <button type="button" className="finance-inline-back" onClick={onBack}>‹ 返回全部账户</button>
      <div className="sa-card">
        <small>{roleLabel(account.type)} · {account.currency}</small>
        <h2 style={{ margin: '4px 0 8px', fontSize: 22 }}>{account.name}</h2>
        <strong className="finance-networth" style={{ display: 'block', fontSize: 28 }}>
          {isDebtRole(role) ? '欠 ' : ''}{currencyMark(account.currency)} {money(investSnap ? investSnap.total : normalizeAccountBalance(account.type, account.balance))}
        </strong>
        {investSnap && (
          <p style={{ margin: '8px 0 0', color: '#8E8E93', fontSize: 13 }}>
            现金 {currencyMark(account.currency)}{money(investSnap.cash)} · 市值 {currencyMark(account.currency)}{money(investSnap.marketValue)}
          </p>
        )}
        <div className="account-hero-ops">
          <button type="button" onClick={onEdit}>编辑</button>
          {role === 'receivable' && account.balance > 0 && <button type="button" onClick={onSettle}>收回</button>}
          {isDebtRole(role) && account.balance > 0 && <button type="button" onClick={onSettle}>还款</button>}
        </div>
      </div>
      <div className="finance-month-grid">
        <article><span>累计收入</span><strong className="income">+{currencyMark(account.currency)}{money(income)}</strong></article>
        <article><span>累计支出</span><strong>−{currencyMark(account.currency)}{money(expense)}</strong></article>
        <article><span>账目</span><strong>{accountItems.length} 笔</strong></article>
      </div>
      {account.type === '理财账户' && (
        <section className="finance-legacy-block">
          <div className="section-title">
            <h2>该账户持仓</h2>
            <button type="button" onClick={onNewHolding}>添加产品</button>
          </div>
          <InvestmentList items={accountHoldings} onSelect={onSelectHolding} />
        </section>
      )}
      <section className="finance-legacy-block">
        <div className="section-title">
          <h2>该账户全部账单</h2>
          <button type="button" onClick={onNewTransaction}>记一笔</button>
        </div>
        <TransactionList items={accountItems} accounts={data.accounts} onEdit={onEditTransaction} onDelete={onDeleteTransaction} onSettle={onSettleReimbursement} />
      </section>
    </div>
  );
}

function InvestmentList({ items, onSelect }: { items: InvestmentHolding[]; onSelect: (id: string) => void }) {
  if (!items.length) return <div className="finance-empty">该币种还没有理财产品</div>;
  return (
    <div className="sa-group">
      {items.map((item) => {
        const profit = investmentProfit(item);
        const rate = item.averageCost > 0 ? profit / (item.quantity * item.averageCost) * 100 : 0;
        return (
          <button key={item.id} type="button" className="sa-row" onClick={() => onSelect(item.id)}>
            <span className="sa-row-text">
              <strong>{item.name}</strong>
              <small>{item.code || `${item.network} · ${item.contract.slice(0, 8)}…`} · {item.quoteStatus === 'live' ? '实时源' : item.quoteStatus === 'manual' ? '手动更新' : '示例'}</small>
            </span>
            <span className="finance-account-balance">
              {currencyMark(item.currency)}{money(investmentValue(item))}
              <small style={{ display: 'block', color: profit >= 0 ? '#2F6F57' : '#8E8E93' }}>
                {profit >= 0 ? '+' : '−'}{currencyMark(item.currency)}{money(Math.abs(profit))} · {rate.toFixed(2)}%
              </small>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function HoldingDetail({ holding, account, onBack, onEdit }: { holding: InvestmentHolding; account?: Account; onBack: () => void; onEdit: () => void }) {
  const profit = investmentProfit(holding);
  const cost = holding.quantity * holding.averageCost;
  const rate = cost ? profit / cost * 100 : 0;
  const values = holding.history.map((item) => item.price);
  const min = Math.min(...values, holding.currentPrice);
  const max = Math.max(...values, holding.currentPrice);
  const spread = Math.max(max - min, Math.abs(max) * 0.02, 0.00000001);
  const points = holding.history.map((item, index) => ({
    ...item,
    x: holding.history.length === 1 ? 50 : index / (holding.history.length - 1) * 100,
    y: 88 - (item.price - min) / spread * 70,
  }));
  const polygon = points.map((point) => `${point.x}% ${point.y}%`).join(', ');
  return (
    <div className="page sa-page finance-page holding-detail">
      <button type="button" className="finance-inline-back" onClick={onBack}>‹ 返回持仓</button>
      <div className="sa-card">
        <small>{holdingKindLabel(holding.kind)} · {holding.quoteStatus === 'live' ? '行情已连接' : holding.quoteStatus === 'manual' ? '手动价格' : '示例行情'}</small>
        <h2 style={{ margin: '4px 0 8px', fontSize: 22 }}>{holding.name}</h2>
        <p style={{ margin: 0, color: '#8E8E93', fontSize: 13 }}>{holding.code}{holding.contract && ` · ${holding.network} · ${holding.contract.slice(0, 8)}…${holding.contract.slice(-6)}`}</p>
        <div className="account-hero-ops"><button type="button" onClick={onEdit}>更新</button></div>
      </div>
      <div className="sa-card">
        <span>当前市值</span>
        <h3 style={{ margin: '6px 0' }}>{currencyMark(holding.currency)} {money(investmentValue(holding))}</h3>
        <strong className={profit >= 0 ? 'income' : ''}>{profit >= 0 ? '+' : '−'}{currencyMark(holding.currency)}{money(Math.abs(profit))}（{rate.toFixed(2)}%）</strong>
        <small style={{ display: 'block', marginTop: 8, color: '#8E8E93' }}>{holding.quantity.toLocaleString('zh-CN')} 份/枚 · 成本 {currencyMark(holding.currency)}{holding.averageCost.toLocaleString('zh-CN')} · {account?.name}</small>
      </div>
      <div className="sa-card">
        <header>
          <h3 style={{ margin: 0 }}>单品收益曲线</h3>
          <small>最近 {holding.history.length} 个价格点</small>
        </header>
        <div className="return-chart">
          <div className="return-area" style={{ clipPath: `polygon(0 100%, ${polygon}, 100% 100%)` }} />
          {points.map((point) => <i key={`${point.date}-${point.price}`} style={{ left: `${point.x}%`, top: `${point.y}%` }} />)}
        </div>
        <footer style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <span>{holding.history[0]?.date ?? '—'}</span>
          <span>{holding.history.at(-1)?.date ?? '—'}</span>
        </footer>
      </div>
      <div className="finance-month-grid">
        <article><span>当前价</span><strong>{currencyMark(holding.currency)}{holding.currentPrice.toLocaleString('zh-CN')}</strong></article>
        <article><span>总成本</span><strong>{currencyMark(holding.currency)}{money(cost)}</strong></article>
        <article><span>最近更新</span><strong>{holding.updatedAt}</strong></article>
      </div>
      <p className="sa-page-footer">收益由你保存或行情服务返回的价格计算，不代表交易所结算值；合约资产请核对网络和合约地址。</p>
    </div>
  );
}

export function TransactionList({ items, accounts, onEdit, onDelete, onSettle }: { items: Transaction[]; accounts: Account[]; onEdit: (id: string) => void; onDelete: (id: string) => void; onSettle?: (id: string) => void }) {
  const visible = items.filter((item) => item.status !== 'reversed' && item.status !== 'superseded' && !item.reversesId);
  if (!visible.length) return <div className="finance-empty">还没有流水</div>;
  return (
    <div className="sa-group">
      {visible.map((item) => (
        <div className="sa-row" key={item.id}>
          <span className="sa-row-text">
            <strong>{item.merchant}{item.reimbursable && <em> {item.reimbursed ? '已报销' : '待报销'}</em>}</strong>
            <small>{item.category} · {accounts.find((account) => account.id === item.accountId)?.name} · {item.source}</small>
          </span>
          <strong className="finance-account-balance">
            {item.kind === 'income' ? '+' : item.kind === 'transfer' ? '↔' : '−'}{currencyMark(item.currency)}{money(item.amount)}
          </strong>
          <div className="row-ops">
            {item.reimbursable && !item.reimbursed && onSettle && <button type="button" className="edit" onClick={() => onSettle(item.id)}>入账</button>}
            <button type="button" className="edit" onClick={() => onEdit(item.id)}>编辑</button>
            <button type="button" className="del" onClick={() => onDelete(item.id)}>删除</button>
          </div>
        </div>
      ))}
    </div>
  );
}
