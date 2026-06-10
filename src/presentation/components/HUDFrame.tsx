import { CYAN, TOP_BAR_H } from '../../infrastructure/constants';

export function HUDFrame() {
  const armLen = 26;
  const off = 18;
  const stroke = `${CYAN}55`;
  const base: React.CSSProperties = { position: 'fixed', width: armLen, height: armLen, pointerEvents: 'none', zIndex: 28 };
  return (
    <>
      <div className="hud-bracket" style={{ ...base, top: TOP_BAR_H + off, left: off,  borderTop:    `1px solid ${stroke}`, borderLeft:  `1px solid ${stroke}` }} />
      <div className="hud-bracket" style={{ ...base, top: TOP_BAR_H + off, right: off, borderTop:    `1px solid ${stroke}`, borderRight: `1px solid ${stroke}` }} />
      <div className="hud-bracket" style={{ ...base, bottom: off,          left: off,  borderBottom: `1px solid ${stroke}`, borderLeft:  `1px solid ${stroke}` }} />
      <div className="hud-bracket" style={{ ...base, bottom: off,          right: off, borderBottom: `1px solid ${stroke}`, borderRight: `1px solid ${stroke}` }} />
    </>
  );
}
