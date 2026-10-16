'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({
  children,
  pendingText = '처리 중…',
  className = 'btn-primary',
  disabled,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? pendingText : children}
    </button>
  );
}
