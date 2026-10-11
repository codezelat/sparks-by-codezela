import { useEffect, useRef, type ReactNode } from 'react';
export default function Modal({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="link-dialog"
      aria-labelledby={titleId}
      onCancel={onClose}
    >
      {children}
    </dialog>
  );
}
