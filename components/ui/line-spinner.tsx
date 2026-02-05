import { cn } from '@/lib/utils';

export function LineSpinner({
  className,
  label = 'Loading',
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn('line-spinner', className)}
      role="status"
      aria-label={label}
    >
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
      <div />
    </div>
  );
}
