import { useEffect, useRef, useState } from 'react';

import { useApi } from './use-api';

export interface ExtractionSourceImageState {
  readonly url: string | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly available: boolean;
}

/**
 * Loads the stored source invoice image via authenticated GET /files/:id.
 */
export function useExtractionSourceImage(
  extractionId: string | null,
  hasStoredFile: boolean,
): ExtractionSourceImageState {
  const api = useApi();
  const apiRef = useRef(api);
  apiRef.current = api;

  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const revoke = (): void => {
      if (objectUrl !== null) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };

    setUrl(null);
    setError(null);

    if (extractionId === null || !hasStoredFile) {
      setLoading(false);
      return revoke;
    }

    setLoading(true);

    void (async () => {
      try {
        const nextUrl = await apiRef.current.fetchExtractionFileObjectUrl(
          extractionId,
        );
        if (cancelled) {
          URL.revokeObjectURL(nextUrl);
          return;
        }
        objectUrl = nextUrl;
        setUrl(nextUrl);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : 'Could not load stored image',
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      revoke();
    };
  }, [extractionId, hasStoredFile]);

  return {
    url,
    loading,
    error,
    available: hasStoredFile,
  };
}
