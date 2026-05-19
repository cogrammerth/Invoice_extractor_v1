import { useCallback, useState } from 'react';

/**
 * Persist a string value in localStorage with SSR-safe reads.
 */
export function useLocalStorage(
  key: string,
): readonly [string, (value: string) => void, () => void] {
  const read = useCallback((): string => {
    try {
      return localStorage.getItem(key) ?? '';
    } catch {
      return '';
    }
  }, [key]);

  const [stored, setStored] = useState<string>(read);

  const setValue = useCallback(
    (value: string) => {
      try {
        if (value.length === 0) {
          localStorage.removeItem(key);
        } else {
          localStorage.setItem(key, value);
        }
      } catch {
        /* quota / private mode */
      }
      setStored(value);
    },
    [key],
  );

  const clear = useCallback(() => {
    setValue('');
  }, [setValue]);

  return [stored, setValue, clear] as const;
}
