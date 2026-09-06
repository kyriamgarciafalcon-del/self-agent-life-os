import { IconCalendar, IconHome, IconList, IconPerson, IconWallet } from './icons';
import { formatNavBadge, PRIMARY_NAV, type PrimaryNavId } from './nav';

const ICONS = {
  home: IconHome,
  schedule: IconCalendar,
  capture: IconList,
  finance: IconWallet,
  profile: IconPerson,
} as const;

export function BottomNav({
  active,
  onChange,
  badge = 0,
  hidden = false,
}: {
  active: PrimaryNavId;
  onChange: (id: PrimaryNavId) => void;
  badge?: number;
  hidden?: boolean;
}) {
  const captureBadge = formatNavBadge(badge);
  return (
    <nav className={`bottom-nav${hidden ? ' inbox-editing' : ''}`} aria-label="主导航">
      <ul>
        {PRIMARY_NAV.map((item) => {
          const Icon = ICONS[item.id];
          const on = active === item.id;
          return (
            <li key={item.id}>
              <button type="button" className={on ? 'active' : ''} onClick={() => onChange(item.id)}>
                <span className="nav-icon">
                  <Icon size={25} filled={on} />
                  {item.id === 'capture' && captureBadge ? <b className="nav-badge">{captureBadge}</b> : null}
                </span>
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
