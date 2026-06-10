import { BG, CYAN, TOP_BAR_H } from '../../infrastructure/constants';

interface TopBarProps {
  query: string;
  onNewQuery: () => void;
}

export function TopBar({ query, onNewQuery }: TopBarProps) {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: TOP_BAR_H,
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10,
      background: `${BG}dd`, backdropFilter: 'blur(12px)',
      borderBottom: `1px solid ${CYAN}1a`, zIndex: 30,
    }}>
      <span style={{ fontFamily: 'Orbitron', fontSize: 13, fontWeight: 900, color: CYAN, letterSpacing: 4, textShadow: `0 0 12px ${CYAN}55`, flexShrink: 0 }}>CORTEX</span>
      <span style={{ color: `${CYAN}33`, fontSize: 10, flexShrink: 0 }}>|</span>
      <span className="chevron-blink" style={{ fontFamily: 'Space Mono', color: CYAN, fontSize: 11, flexShrink: 0 }}>&gt;&gt;</span>
      <span style={{ fontFamily: 'Space Mono', fontSize: 12, color: '#ccc', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
        {query}
      </span>
      <button
        onClick={onNewQuery}
        style={{ background: 'transparent', border: `1px solid ${CYAN}33`, borderRadius: 2, color: `${CYAN}77`, fontFamily: 'Space Mono', fontSize: 9, padding: '4px 10px', cursor: 'pointer', letterSpacing: 2, transition: 'all 0.2s', flexShrink: 0 }}
        onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = CYAN; (e.target as HTMLElement).style.color = CYAN; (e.target as HTMLElement).style.boxShadow = `0 0 8px ${CYAN}33`; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = `${CYAN}33`; (e.target as HTMLElement).style.color = `${CYAN}77`; (e.target as HTMLElement).style.boxShadow = 'none'; }}
      >
        NEW QUERY
      </button>
    </div>
  );
}
