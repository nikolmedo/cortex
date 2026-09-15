import type { CSSProperties } from 'react';
import { ExternalLink } from 'lucide-react';
import { safeHttpsUrl, type SceneSource } from '../../../domain/Scene';
import styles from './SourcesList.module.css';

interface SourcesListProps {
  sources: SceneSource[];
  color: string;
}

function hostOf(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '');
}

export function SourcesList({ sources, color }: SourcesListProps) {
  return (
    <ol className={styles.list} style={{ '--c': color } as CSSProperties}>
      {sources.map((source, i) => {
        const href = safeHttpsUrl(source.url);
        if (href === '') return null;
        return (
          <li key={i} className={styles.row}>
            <span className={styles.index}>{String(i + 1).padStart(2, '0')}</span>
            <a className={styles.link} href={href} target="_blank" rel="noopener noreferrer">
              <span className={styles.title}>{source.title || hostOf(href)}</span>
              <span className={styles.host}>
                {hostOf(href)}
                <ExternalLink size={9} strokeWidth={1.75} aria-hidden="true" />
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
