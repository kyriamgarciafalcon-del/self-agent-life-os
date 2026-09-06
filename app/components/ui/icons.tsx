type IconProps = { size?: number; className?: string; filled?: boolean };

export function IconHome({ size = 24, className, filled }: IconProps) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M12.5 3.2a.9.9 0 0 0-1 0L3.7 9.4a.9.9 0 0 0-.3.7v9.2c0 .9.7 1.6 1.6 1.6h4.2V14.5c0-.7.5-1.2 1.2-1.2h2.2c.7 0 1.2.5 1.2 1.2v6.4h4.2c.9 0 1.6-.7 1.6-1.6V10.1a.9.9 0 0 0-.3-.7l-7.8-6.2Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" />
    </svg>
  );
}

export function IconCalendar({ size = 24, className, filled }: IconProps) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M7 3.2a.9.9 0 0 1 .9.9V5h8.2V4.1a.9.9 0 1 1 1.8 0V5H19a2.5 2.5 0 0 1 2.5 2.5v12A2.5 2.5 0 0 1 19 22H5a2.5 2.5 0 0 1-2.5-2.5v-12A2.5 2.5 0 0 1 5 5h1.1V4.1A.9.9 0 0 1 7 3.2ZM4.3 10.2h15.4v9.3c0 .7-.5 1.2-1.2 1.2H5.5c-.7 0-1.2-.5-1.2-1.2v-9.3Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.2" />
      <path d="M8 3.5V6.5M16 3.5V6.5M3.5 9.5h17" />
    </svg>
  );
}

export function IconList({ size = 24, className, filled }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={filled ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M9 7h11M9 12h11M9 17h11" />
      <circle cx="5" cy="7" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconWallet({ size = 24, className, filled }: IconProps) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M4.5 6.5A2.5 2.5 0 0 1 7 4h11.5A1.5 1.5 0 0 1 20 5.5V7H7a1 1 0 0 0 0 2h13.5A1.5 1.5 0 0 1 22 10.5v7A2.5 2.5 0 0 1 19.5 20h-13A2.5 2.5 0 0 1 4 17.5v-11Zm14 7.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H19a1 1 0 0 1 1 1v1.5H7a1 1 0 0 0 0 2h13v7A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-9Z" />
      <circle cx="17" cy="14.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPerson({ size = 24, className, filled }: IconProps) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path d="M12 12a4.2 4.2 0 1 0 0-8.4A4.2 4.2 0 0 0 12 12Zm0 1.8c-3.6 0-8 1.8-8 4.5V20a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.7c0-2.7-4.4-4.5-8-4.5Z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c0-2.8 3.1-4.5 7-4.5s7 1.7 7 4.5" />
    </svg>
  );
}

export function IconBack({ size = 22, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M15 5 8 12l7 7" />
    </svg>
  );
}
