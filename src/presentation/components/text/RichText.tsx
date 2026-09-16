import { useRef, type CSSProperties, type ReactElement } from 'react';
import { STAGGER_CAP_MS } from '../../motion/motion';
import styles from './RichText.module.css';

/*
 * Safe inline markup for model text: `**bold**` and `` `code` `` only. The input
 * is already sanitized; everything becomes React text nodes, never HTML.
 */

type Token = { kind: 'text' | 'strong' | 'code'; value: string };

const INLINE_RE = /(\*\*[^*\n]+?\*\*|`[^`\n]+?`)/g;

export function parseInline(text: string): Token[] {
  const tokens: Token[] = [];
  for (const part of text.split(INLINE_RE)) {
    if (part === '') continue;
    if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      tokens.push({ kind: 'strong', value: part.slice(2, -2) });
    } else if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      tokens.push({ kind: 'code', value: part.slice(1, -1) });
    } else {
      tokens.push({ kind: 'text', value: part });
    }
  }
  return tokens;
}

/** Splits plain text after clause punctuation so phrases can fade in one by one. */
function phrases(text: string): string[] {
  return text.split(/(?<=[,.;:!?¿¡—])\s+/).filter(Boolean);
}

interface RichTextProps {
  text: string;
  /** Fade the text in phrase by phrase (arriving content). */
  reveal?: boolean;
  /** Base delay before the first phrase, in ms. */
  delay?: number;
}

export function RichText({ text, reveal = false, delay = 0 }: RichTextProps): ReactElement {
  const tokens = parseInline(text);
  // Text that grows while it streams keeps the delay each piece was mounted with,
  // so already visible phrases never re-animate when new ones arrive.
  const settled = useRef(new Map<string, number>());

  if (!reveal) {
    return (
      <>
        {tokens.map((tok, i) => renderToken(tok, i))}
      </>
    );
  }

  const pieces: Array<{ tok: Token; key: string }> = [];
  tokens.forEach((tok, i) => {
    if (tok.kind !== 'text') {
      pieces.push({ tok, key: `${i}` });
      return;
    }
    phrases(tok.value).forEach((p, j, all) => {
      const trailing = j < all.length - 1 || /\s$/.test(tok.value) ? ' ' : '';
      const leading = j === 0 && /^\s/.test(tok.value) ? ' ' : '';
      pieces.push({ tok: { kind: 'text', value: `${leading}${p}${trailing}` }, key: `${i}.${j}` });
    });
  });

  const budget = Math.max(0, STAGGER_CAP_MS - delay);
  const step = pieces.length > 1 ? Math.min(45, budget / (pieces.length - 1)) : 0;
  // Counted before this render adds to the map: on the first render every phrase
  // staggers, and later renders only stagger the phrases that just arrived.
  const alreadySettled = settled.current.size;

  return (
    <>
      {pieces.map(({ tok, key }, i) => {
        const known = settled.current.get(key);
        const ms = known ?? Math.round(delay + Math.max(0, i - alreadySettled) * step);
        if (known === undefined) settled.current.set(key, ms);
        return (
          <span key={key} className={styles.phrase} style={{ animationDelay: `${ms}ms` } as CSSProperties}>
            {renderToken(tok, key)}
          </span>
        );
      })}
    </>
  );
}

function renderToken(tok: Token, key: string | number) {
  if (tok.kind === 'strong') return <strong key={key} className={styles.strong}>{tok.value}</strong>;
  if (tok.kind === 'code') return <code key={key} className={styles.code}>{tok.value}</code>;
  return <span key={key}>{tok.value}</span>;
}
