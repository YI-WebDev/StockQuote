import { useEffect } from 'react';

type Entry = {
  selector: string | string[];
  onOutside: () => void;
};

/**
 * 指定セレクタの外側をクリックしたときにコールバックを呼ぶフック。
 * selector に複数指定した場合、「いずれにも当てはまらない」ときに発火する。
 */
export function useOutsideClick(entries: Entry[]): void {
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      for (const { selector, onOutside } of entries) {
        const selectors = Array.isArray(selector) ? selector : [selector];
        const isInside = selectors.some(s => target.closest(s));
        if (!isInside) {
          onOutside();
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
