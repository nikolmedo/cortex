import { useEffect, useRef, type ReactElement } from 'react';
import type { Turn } from '../../../application/useCortex';
import { TurnView } from './TurnView';
import styles from './SessionStream.module.css';

interface SessionStreamProps {
  turns: Turn[];
  reduced: boolean;
  onRetry: (turnId: string) => void;
  onFollowup: (query: string) => void;
}

/** Every turn of the session, oldest first; a new turn scrolls to the top of the view. */
export function SessionStream({ turns, reduced, onRetry, onFollowup }: SessionStreamProps): ReactElement {
  const count = turns.length;
  const previous = useRef(count);
  const lastId = count > 0 ? turns[count - 1].id : '';

  useEffect(() => {
    if (count > previous.current && lastId) {
      document.getElementById(lastId)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    }
    previous.current = count;
  }, [count, lastId, reduced]);

  return (
    <div className={styles.stream}>
      {turns.map((turn, i) => (
        <TurnView
          key={turn.id}
          turn={turn}
          isLatest={i === count - 1}
          reduced={reduced}
          onRetry={onRetry}
          onFollowup={onFollowup}
        />
      ))}
    </div>
  );
}
