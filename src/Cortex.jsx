import React from 'react';
import { MAGENTA } from './constants/index.js';
import { GlobalStyles } from './styles/global.js';
import { useCortex } from './hooks/useCortex.js';
import { HexGrid } from './components/HexGrid.jsx';
import { QueryInput } from './components/QueryInput.jsx';
import { TopBar } from './components/TopBar.jsx';
import { MetaHUD } from './components/MetaHUD.jsx';
import { QueryHistory } from './components/QueryHistory.jsx';
import { HUDFrame } from './components/HUDFrame.jsx';
import { KnowledgeGraph } from './components/graph/KnowledgeGraph.jsx';

export default function Cortex() {
  const {
    query, phase, graphData, history,
    hoveredCat, setHoveredCat,
    error, viewport,
    handleSubmit, handleNewQuery,
  } = useCortex();

  const { W, H } = viewport;
  const active = phase === 'loading' || phase === 'graph';

  return (
    <div className="cortex-root">
      <GlobalStyles />
      <HexGrid W={W} H={H} />

      {phase === 'input' && <QueryInput onSubmit={handleSubmit} />}

      {active && <TopBar query={query} onNewQuery={handleNewQuery} />}
      {active && <HUDFrame />}
      {active && (
        <KnowledgeGraph
          graphData={graphData}
          phase={phase}
          hoveredCat={hoveredCat}
          setHoveredCat={setHoveredCat}
          W={W} H={H}
        />
      )}

      {phase === 'graph' && <MetaHUD graphData={graphData} />}

      <QueryHistory history={history} onSelect={handleSubmit} />

      {error && <ErrorToast message={error} />}
    </div>
  );
}

function ErrorToast({ message }) {
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 20, zIndex: 50,
      background: `${MAGENTA}18`, border: `1px solid ${MAGENTA}55`,
      borderRadius: 4, padding: '10px 14px',
      fontFamily: 'Space Mono', fontSize: 10, color: MAGENTA,
      boxShadow: `0 0 16px ${MAGENTA}22`, maxWidth: 300,
    }}>
      {message}
    </div>
  );
}
