import type { Metadata } from 'next';
import './globals.css';
import './finance.css';
import './editing.css';
import './feature-hub.css';
import './travel-investments.css';
export const metadata:Metadata={title:'Self Agent｜本机优先个人管家',description:'日程、快速记录与多账户财务，先整理、确认后保存。'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-CN"><body>{children}</body></html>}
