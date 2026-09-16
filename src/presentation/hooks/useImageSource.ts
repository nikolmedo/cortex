import { useCallback, useEffect, useState } from 'react';

export interface ImageSource {
  /** The URL to show, or null when there is none or it failed to load. */
  src: string | null;
  onError: () => void;
}

/** Tracks one image URL and drops it when loading fails, so the layout can close the gap. */
export function useImageSource(url: string | null): ImageSource {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  const onError = useCallback(() => setFailed(true), []);
  return { src: url && !failed ? url : null, onError };
}
