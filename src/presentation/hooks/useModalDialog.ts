import { useEffect, useId, useRef, type RefObject } from 'react';

/**
 * Tabbable candidates. `[tabindex="-1"]` is excluded on purpose: the panel
 * itself carries it so it can receive focus without joining the tab ring.
 */
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface ModalDialogOptions {
  onClose: () => void;
  /** Selector for the element to focus on open; defaults to the first tabbable one. */
  initialFocus?: string;
}

interface ModalDialog<T extends HTMLElement> {
  /** Attach to the panel element; it is the trap boundary. */
  ref: RefObject<T | null>;
  /** Spread on the panel. `tabIndex` lets an empty panel still hold focus. */
  dialogProps: { role: 'dialog'; 'aria-modal': true; tabIndex: -1 };
  /** For the panel's `aria-labelledby` and the title element's `id`. */
  titleId: string;
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

/** Visible tabbables only. `offsetParent` lies about fixed elements, so measure boxes instead. */
function tabbables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(el => el.getClientRects().length > 0);
}

/**
 * The one modal pattern: initial focus, focus restore, a real Tab trap, Escape,
 * and suppression of the global search shortcuts while the dialog is open.
 * The caller still owns `createPortal` and its own markup.
 */
export function useModalDialog<T extends HTMLElement = HTMLDivElement>(
  { onClose, initialFocus }: ModalDialogOptions,
): ModalDialog<T> {
  const ref = useRef<T | null>(null);
  const titleId = useId();

  // Callers pass inline closures; keeping them in a ref means the effect below
  // runs once per dialog instead of once per render, so focus is not stolen back
  // to the trigger on every parent update.
  const latest = useRef({ onClose, initialFocus });
  useEffect(() => {
    latest.current = { onClose, initialFocus };
  });

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return undefined;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const selector = latest.current.initialFocus;
    const preferred = selector ? panel.querySelector<HTMLElement>(selector) : null;
    (preferred ?? tabbables(panel)[0] ?? panel).focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        latest.current.onClose();
        return;
      }

      // The window-level "/" and Ctrl/Cmd+K shortcuts would pull focus out of the
      // dialog and into the command bar behind it. Capture phase stops the event
      // before any bubble-phase window listener sees it, which is why this cannot
      // live in the shortcut owner itself.
      const combo = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
      const slash = e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isEditable(e.target);
      if (combo || slash) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key !== 'Tab') return;
      const items = tabbables(panel);
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      // Focus can sit outside the panel (the panel itself, or the page behind a
      // portal); either way the next Tab belongs to the dialog.
      if (!(active instanceof HTMLElement) || !panel.contains(active) || active === panel) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      previous?.focus();
    };
  }, []);

  return { ref, dialogProps: { role: 'dialog', 'aria-modal': true, tabIndex: -1 }, titleId };
}
