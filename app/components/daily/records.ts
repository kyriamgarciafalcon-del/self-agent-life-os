export function inboxKindLabel(action: string): string {
  if (action === 'create_expense' || action === 'create_income' || action === 'create_transfer') return '财务';
  if (action === 'create_schedule') return '日程';
  if (action === 'create_health') return '健康';
  if (action === 'create_travel' || action === 'update_travel') return '出行';
  return '其他';
}

export function inboxConfirmLabel(action: string): string {
  return action === 'create_expense' || action === 'create_income' || action === 'create_transfer' ? '确认入账' : '确认写入';
}
