import { MAGENTA } from './infrastructure/constants';
import { GlobalStyles } from './presentation/styles/global';
import { useCortex } from './application/useCortex';
import { HexGrid } from './presentation/components/HexGrid';
import { QueryInput } from './presentation/components/QueryInput';
import { TopBar } from './presentation/components/TopBar';
import { MetaHUD } from './presentation/components/MetaHUD';
import { QueryHistory } from './presentation/components/QueryHistory';
import { HUDFrame } from './presentation/components/HUDFrame';
import { KnowledgeGraph } from './presentation/components/graph/KnowledgeGraph';

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

function ErrorToast({ message }: { message: string }) {
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
