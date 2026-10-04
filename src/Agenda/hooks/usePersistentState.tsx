import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

/**
 * useState que lembra o valor no localStorage (sobrevive a fechar o app).
 * `validate` descarta valores salvos em formato antigo/corrompido.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  validate?: (value: unknown) => value is T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (!validate || validate(parsed)) return parsed as T;
      }
    } catch {
      /* storage indisponível ou JSON inválido: usa o valor inicial */
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* sem espaço/indisponível: ignora */
    }
  }, [key, value]);

  return [value, setValue];
}
