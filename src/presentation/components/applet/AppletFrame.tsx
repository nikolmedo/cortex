import { useEffect, useId, useMemo, useRef, useState, type ReactElement } from 'react';
import { RotateCcw } from 'lucide-react';
import type { AppletState } from '../../../domain/Scene';
import { useI18n } from '../../../i18n/I18nContext';
import type { Locale } from '../../../i18n/translations';
import { buildAppletDocument } from './appletDocument';
import { APPLET_INITIAL_HEIGHT, appletFrameAttributes, readAppletSize } from './appletSandbox';
import styles from './AppletFrame.module.css';

interface AppletFrameProps {
  applet: AppletState;
  /** Response language of the turn; set as the frame document's lang. */
  lang: Locale;
}

interface SandboxProps {
  html: string;
  title: string;
  lang: Locale;
  onNavigate: () => void;
}

/**
 * The one place generated markup is rendered, and only ever as an iframe
 * srcdoc. Mounted under a fresh key on every reload, so its load counter and
 * its height start over with the new frame.
 */
function Sandbox({ html, title, lang, onNavigate }: SandboxProps): ReactElement {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const loads = useRef(0);
  const [height, setHeight] = useState(APPLET_INITIAL_HEIGHT);
  const srcDoc = useMemo(() => buildAppletDocument(html, lang), [html, lang]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const next = readAppletSize(event, frameRef.current?.contentWindow);
      if (next !== null) setHeight(next);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // The sandbox cannot stop a frame from navigating itself, so the first load
  // is the srcdoc and any later one means the applet left it.
  const onLoad = () => {
    loads.current += 1;
    if (loads.current > 1) onNavigate();
  };

  return (
    <iframe
      ref={frameRef}
      className={styles.frame}
      {...appletFrameAttributes(title, srcDoc)}
      style={{ height }}
      onLoad={onLoad}
    />
  );
}

/** Lead block of a turn: the generated tool, its waiting and failure states, and its toolbar. */
export function AppletFrame({ applet, lang }: AppletFrameProps): ReactElement {
  const { t } = useI18n();
  const [generation, setGeneration] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const sourceId = useId();
  const title = applet.title || t('applet.kind');
  const html = applet.status === 'ready' ? applet.html : undefined;
  const state = html === undefined ? (applet.status === 'pending' ? 'pending' : 'failed') : stopped ? 'stopped' : 'ready';

  const reload = () => {
    setStopped(false);
    setGeneration(n => n + 1);
  };

  return (
    <section className={styles.applet} data-state={state} aria-label={t('applet.label', { title })}>
      <header className={styles.bar}>
        <span className={styles.tag}>{title}</span>
        <span className={styles.kind}>{t('applet.kind')}</span>
        {html !== undefined ? (
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={reload}>
              <RotateCcw size={14} aria-hidden="true" />
              {t('applet.reload')}
            </button>
            <button
              type="button"
              className={styles.button}
              aria-expanded={showSource}
              aria-controls={sourceId}
              onClick={() => setShowSource(v => !v)}
            >
              {t('applet.source')}
            </button>
          </div>
        ) : null}
      </header>

      {state === 'pending' ? (
        <div className={styles.placeholder} role="status">
          <span className={styles.scan} aria-hidden="true" />
          <p className={styles.status}>{t('applet.building')}</p>
          <p className={styles.hint}>{t('applet.buildingHint')}</p>
        </div>
      ) : null}

      {state === 'failed' ? <p className={styles.message} role="status">{t('applet.failed')}</p> : null}
      {state === 'stopped' ? <p className={styles.message} role="status">{t('applet.stopped')}</p> : null}

      {state === 'ready' && html !== undefined ? (
        <Sandbox key={generation} html={html} title={title} lang={lang} onNavigate={() => setStopped(true)} />
      ) : null}

      {html !== undefined && showSource ? (
        <pre id={sourceId} className={styles.source} aria-label={t('applet.sourceLabel', { title })} tabIndex={0}>
          {html}
        </pre>
      ) : null}
    </section>
  );
}
