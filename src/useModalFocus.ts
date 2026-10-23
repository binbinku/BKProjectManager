import { useEffect, useRef } from 'react';

export function useModalFocus(onClose: () => void, busy: boolean) {
  const modalRef = useRef<HTMLElement>(null);
  const current = useRef({ onClose, busy });
  current.current = { onClose, busy };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const modal = modalRef.current;
    (
      modal?.querySelector<HTMLElement>('input, select') ??
      modal?.querySelector<HTMLElement>('button')
    )?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!current.current.busy) current.current.onClose();
      }
      if (event.key !== 'Tab' || !modal) return;
      const elements = [
        ...modal.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
        ),
      ];
      const first = elements[0],
        last = elements.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first || !modal.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !modal.contains(document.activeElement))
      ) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    const modal = modalRef.current;
    if (!busy && modal && !modal.contains(document.activeElement)) {
      modal
        .querySelector<HTMLElement>(
          'input:not(:disabled), select:not(:disabled), button:not(:disabled)',
        )
        ?.focus();
    }
  }, [busy]);
  return modalRef;
}
