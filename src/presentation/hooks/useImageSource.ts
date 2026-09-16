import { useCallback, useState } from 'react';

export type ImageStatus = 'loading' | 'loaded' | 'error';

export interface ImageSource {
  /**
   * The URL to show, or null when the scene carries none. It survives a failed
   * load: the figure keeps its slot so the layout never re-templates after the
   * grid has been drawn. Read `status` to know what to paint.
   */
  src: string | null;
  status: ImageStatus;
  onLoad: () => void;
  onError: () => void;
}

/** Tracks one image URL through its load so the layout can reserve room for it up front. */
export function useImageSource(url: string | null): ImageSource {
  const [tracked, setTracked] = useState<{ url: string | null; status: ImageStatus }>({ url, status: 'loading' });

  // Adjusting during render instead of in an effect: a new URL must not be
  // reported as `loaded` for one frame with the previous image's result.
  if (tracked.url !== url) setTracked({ url, status: 'loading' });
  const status = tracked.url === url ? tracked.status : 'loading';

  const onLoad = useCallback(() => setTracked(prev => ({ ...prev, status: 'loaded' })), []);
  const onError = useCallback(() => setTracked(prev => ({ ...prev, status: 'error' })), []);

  return { src: url, status, onLoad, onError };
}
