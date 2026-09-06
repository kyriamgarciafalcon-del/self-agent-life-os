export const SHELL_TOKENS = {
  pageBg: '#F2F2F7',
  surface: '#FFFFFF',
  accent: '#2F6F57',
  secondary: '#8E8E93',
  tapMin: 44,
  navHeight: 49,
} as const;

export const PRIMARY_NAV = [
  { id: 'home', label: '首页' },
  { id: 'schedule', label: '日程' },
  { id: 'capture', label: '记录' },
  { id: 'finance', label: '财务' },
  { id: 'profile', label: '我的' },
] as const;

export type PrimaryNavId = (typeof PRIMARY_NAV)[number]['id'];

export function isPrimaryNavTab(id: string): id is PrimaryNavId {
  return PRIMARY_NAV.some((item) => item.id === id);
}

export function primaryNavActiveId(tab: string): PrimaryNavId {
  return isPrimaryNavTab(tab) ? tab : 'profile';
}

export function formatNavBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 9 ? '9+' : String(count);
}
