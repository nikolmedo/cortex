import { useCallback, useEffect, useState } from 'react';

export interface ImageCascade {
  /** Current candidate URL, or null when all sources failed (show monogram). */
  src: string | null;
  isMonogram: boolean;
  onError: () => void;
}

/**
 * Image source cascade shared by every image consumer:
 * direct URL → keyword fallback (loremflickr) → animated monogram.
 */
export function useImageCascade(directUrl: string | undefined, fallbackUrl: string | null): ImageCascade {
  const initialStage = directUrl ? 0 : fallbackUrl ? 1 : 2;
  const [stage, setStage] = useState(initialStage);

  useEffect(() => {
    setStage(directUrl ? 0 : fallbackUrl ? 1 : 2);
  }, [directUrl, fallbackUrl]);

  const onError = useCallback(() => setStage(s => s + 1), []);

  const src = stage === 0 ? directUrl ?? null : stage === 1 ? fallbackUrl : null;
  return { src, isMonogram: src == null, onError };
}
