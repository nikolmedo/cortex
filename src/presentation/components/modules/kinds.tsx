import { useEffect, useRef, useState, type CSSProperties, type ReactElement } from 'react';
import { Check, Copy, Minus, Plus } from 'lucide-react';
import type { SceneItem } from '../../../domain/Scene';
import { useI18n } from '../../../i18n/I18nContext';
import { RichText } from '../text/RichText';
import { moduleItems } from './items';
import type { ModuleRendererProps } from './registry';
import styles from './kinds.module.css';

function Detail({ text }: { text?: string }) {
  return text ? <p className={styles.detail}><RichText text={text} /></p> : null;
}

/** 0-1 fraction as a CSS number for scaleX bars (computed, never model text). */
function fraction(value: number): CSSProperties {
  return { '--w': Math.min(1, Math.max(0, value)).toFixed(3) } as CSSProperties;
}

export function ListModule({ module }: ModuleRendererProps): ReactElement {
  return (
    <ul className={styles.list}>
      {moduleItems(module).map((item, i) => (
        <li key={i} className={styles.listItem}>
          <span className={styles.dot} aria-hidden="true" />
          <div className={styles.listText}>
            <span className={styles.label}>{item.label}</span>
            <Detail text={item.detail} />
          </div>
          {item.value ? <span className={styles.listValue}>{item.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function TimelineModule({ module }: ModuleRendererProps): ReactElement {
  return (
    <ol className={styles.timeline}>
      {moduleItems(module).map((item, i) => (
        <li key={i} className={styles.tlItem}>
          <span className={styles.tlNode} aria-hidden="true" />
          {item.value ? <span className={styles.tlDate}>{item.value}</span> : null}
          <span className={styles.label}>{item.label}</span>
          <Detail text={item.detail} />
        </li>
      ))}
    </ol>
  );
}

function Gauge({ weight }: { weight: number }) {
  const w = Math.min(100, Math.max(0, weight));
  return (
    <svg className={styles.gauge} viewBox="0 0 40 40" aria-hidden="true">
      <circle className={styles.gaugeTrack} cx="20" cy="20" r="16" pathLength={100} />
      <circle
        className={styles.gaugeFill}
        cx="20"
        cy="20"
        r="16"
        pathLength={100}
        strokeDasharray={`${w.toFixed(1)} 100`}
        transform="rotate(-90 20 20)"
      />
    </svg>
  );
}

export function StatsModule({ module }: ModuleRendererProps): ReactElement {
  return (
    <div className={styles.stats}>
      {moduleItems(module).map((item, i) => (
        <div key={i} className={styles.stat}>
          {item.weight != null ? <Gauge weight={item.weight} /> : null}
          <div className={styles.statText}>
            {item.value ? <span className={styles.figure}>{item.value}</span> : null}
            <span className={styles.statLabel}>{item.label}</span>
            <Detail text={item.detail} />
          </div>
        </div>
      ))}
    </div>
  );
}

function SideCell({ item }: { item: SceneItem }) {
  return (
    <div className={styles.sideCell}>
      <span className={styles.label}>{item.label}</span>
      {item.value ? <span className={styles.sideValue}>{item.value}</span> : null}
      <Detail text={item.detail} />
    </div>
  );
}

export function ComparisonModule({ module }: ModuleRendererProps): ReactElement {
  const { t } = useI18n();
  const items = moduleItems(module);
  const b = items.filter(it => it.side === 'b');
  const a = items.filter(it => it.side !== 'b');

  if (b.length === 0) {
    return (
      <dl className={styles.rows}>
        {items.map((item, i) => (
          <div key={i} className={styles.row}>
            <dt className={styles.rowKey}>{item.label}</dt>
            <dd className={styles.rowValue}>
              {item.value ?? ''}
              <Detail text={item.detail} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className={styles.sides}>
      <div className={styles.side} data-side="a">
        <h4 className={styles.sideHead}>{t('module.sideA')}</h4>
        {a.map((item, i) => <SideCell key={i} item={item} />)}
      </div>
      <div className={styles.side} data-side="b">
        <h4 className={styles.sideHead}>{t('module.sideB')}</h4>
        {b.map((item, i) => <SideCell key={i} item={item} />)}
      </div>
    </div>
  );
}

export function QuoteModule({ module }: ModuleRendererProps): ReactElement {
  return (
    <div className={styles.quotes}>
      {moduleItems(module).map((item, i) => (
        <figure key={i} className={styles.quote}>
          <blockquote className={styles.quoteText}>
            <p><RichText text={item.label} /></p>
          </blockquote>
          {item.value || item.detail ? (
            <figcaption className={styles.cite}>{[item.value, item.detail].filter(Boolean).join(' · ')}</figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}

export function RankingModule({ module }: ModuleRendererProps): ReactElement {
  const items = moduleItems(module);
  const top = Math.max(1, ...items.map(it => it.weight ?? 0));
  return (
    <ol className={styles.ranking}>
      {items.map((item, i) => {
        const w = item.weight != null ? item.weight / top : 1 - i / (items.length + 1);
        return (
          <li key={i} className={styles.rankRow}>
            <span className={styles.rankNum}>{i + 1}</span>
            <span className={styles.rankLabel}>{item.label}</span>
            {item.value ? <span className={styles.rankValue}>{item.value}</span> : null}
            <span className={styles.track} aria-hidden="true">
              <span className={styles.fill} style={fraction(w)} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ProgressModule({ module }: ModuleRendererProps): ReactElement {
  return (
    <div className={styles.progress}>
      {moduleItems(module).map((item, i) => (
        <div key={i} className={styles.progRow}>
          <div className={styles.progHead}>
            <span className={styles.label}>{item.label}</span>
            <span className={styles.progValue}>{item.value ?? (item.weight != null ? `${Math.round(item.weight)}%` : '')}</span>
          </div>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} style={fraction((item.weight ?? 0) / 100)} />
          </span>
          <Detail text={item.detail} />
        </div>
      ))}
    </div>
  );
}

export function KeyValueModule({ module }: ModuleRendererProps): ReactElement {
  return (
    <dl className={styles.kv}>
      {moduleItems(module).map((item, i) => (
        <div key={i} className={styles.kvPair}>
          <dt className={styles.kvKey}>{item.label}</dt>
          {item.value || item.detail ? (
            <dd className={styles.kvValue}>
              {item.value ?? <RichText text={item.detail ?? ''} />}
              {item.value ? <Detail text={item.detail} /> : null}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}

export function TagsModule({ module }: ModuleRendererProps): ReactElement {
  return (
    <ul className={styles.tags}>
      {moduleItems(module).map((item, i) => (
        <li key={i} className={styles.tag}>
          {item.label}
          {item.value ? <span className={styles.tagValue}>{item.value}</span> : null}
        </li>
      ))}
    </ul>
  );
}

export function StepsModule({ module }: ModuleRendererProps): ReactElement {
  return (
    <ol className={styles.steps}>
      {moduleItems(module).map((item, i) => (
        <li key={i} className={styles.step}>
          <span className={styles.stepNum} aria-hidden="true">{i + 1}</span>
          <div className={styles.stepBody}>
            <div className={styles.stepHead}>
              <span className={styles.stepLabel}>{item.label}</span>
              {item.value ? <span className={styles.stepResult}>{item.value}</span> : null}
            </div>
            <Detail text={item.detail} />
          </div>
        </li>
      ))}
    </ol>
  );
}

export function FormulaModule({ module }: ModuleRendererProps): ReactElement {
  return (
    <div className={styles.formulas}>
      {moduleItems(module).map((item, i) => (
        <figure key={i} className={styles.formula}>
          <pre className={styles.formulaExpr} tabIndex={0}><code>{item.label}</code></pre>
          {item.value || item.detail ? (
            <figcaption className={styles.formulaCaption}>
              {item.value ? <span className={styles.formulaName}>{item.value}</span> : null}
              <Detail text={item.detail} />
            </figcaption>
          ) : null}
        </figure>
      ))}
    </div>
  );
}

export function CodeModule({ module }: ModuleRendererProps): ReactElement {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const body = module.body;
  if (!body) return <ListModule module={module} />;

  const copy = () => {
    navigator.clipboard?.writeText(body).then(() => {
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1600);
    }, () => undefined);
  };

  return (
    <div className={styles.code}>
      <div className={styles.codeBar}>
        <span className={styles.codeLang}>{module.value ?? t('scene.kind.code')}</span>
        <button type="button" className={styles.copy} onClick={copy}>
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          <span>{t(copied ? 'module.copied' : 'module.copy')}</span>
        </button>
      </div>
      <pre className={styles.codePre} tabIndex={0}><code>{body}</code></pre>
    </div>
  );
}

export function ProseModule({ module }: ModuleRendererProps): ReactElement {
  const paragraphs = module.body ? [module.body] : module.facts;
  return (
    <div className={styles.prose}>
      {paragraphs.map((p, i) => <p key={i}><RichText text={p} /></p>)}
    </div>
  );
}

function PcItem({ item }: { item: SceneItem }) {
  return (
    <li className={styles.pcItem}>
      <div className={styles.pcItemHead}>
        <span className={styles.label}>{item.label}</span>
        {item.value ? <span className={styles.pcValue}>{item.value}</span> : null}
      </div>
      <Detail text={item.detail} />
    </li>
  );
}

export function ProsConsModule({ module }: ModuleRendererProps): ReactElement {
  const { t } = useI18n();
  const items = moduleItems(module);
  const pros = items.filter(it => it.side !== 'b');
  const cons = items.filter(it => it.side === 'b');
  return (
    <div className={styles.pc}>
      {pros.length > 0 ? (
        <div className={styles.pcCol} data-side="pro">
          <h4 className={styles.pcHead}><Plus size={14} aria-hidden="true" />{t('module.pros')}</h4>
          <ul className={styles.pcList}>{pros.map((item, i) => <PcItem key={i} item={item} />)}</ul>
        </div>
      ) : null}
      {cons.length > 0 ? (
        <div className={styles.pcCol} data-side="con">
          <h4 className={styles.pcHead}><Minus size={14} aria-hidden="true" />{t('module.cons')}</h4>
          <ul className={styles.pcList}>{cons.map((item, i) => <PcItem key={i} item={item} />)}</ul>
        </div>
      ) : null}
    </div>
  );
}
