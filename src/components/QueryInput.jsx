import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { CYAN } from '../constants/index.js';

export function QueryInput({ onSubmit }) {
  const [val, setVal] = useState('');
  const submit = () => val.trim() && onSubmit(val.trim());

  return (
    <div className="query-wrap" style={{
      position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', zIndex: 20, padding: '0 24px',
    }}>
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Orbitron', fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, color: CYAN, letterSpacing: 12, lineHeight: 1, textShadow: `0 0 40px ${CYAN}88` }}>
          CORTEX
        </div>
        <div style={{ fontFamily: 'Space Mono', fontSize: 11, color: `${CYAN}66`, letterSpacing: 6, marginTop: 10 }}>
          KNOWLEDGE GRAPH ENGINE
        </div>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: 520 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="chevron-blink" style={{ fontFamily: 'Space Mono', color: CYAN, fontSize: 14, userSelect: 'none', flexShrink: 0 }}>&gt;&gt;</span>
          <input
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="QUERY Cortex..."
            style={{
              flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
              fontFamily: 'Space Mono', fontSize: 'clamp(13px, 2vw, 16px)', color: '#fff',
              caretColor: CYAN, letterSpacing: 1,
            }}
          />
          <Search
            size={15}
            color={val ? CYAN : `${CYAN}33`}
            style={{ cursor: val ? 'pointer' : 'default', transition: 'color 0.2s', flexShrink: 0 }}
            onClick={submit}
          />
        </div>
        <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${CYAN}, transparent)`, marginTop: 10, boxShadow: `0 0 8px ${CYAN}55` }} />
      </div>

      <div style={{ marginTop: 20, fontFamily: 'Space Mono', fontSize: 10, color: `${CYAN}33`, letterSpacing: 4 }}>
        PRESS ENTER TO SEARCH
      </div>
    </div>
  );
}
