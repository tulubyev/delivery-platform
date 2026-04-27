import { cn } from '@/lib/utils'

const variants: Record<string, string> = {
  default:     'bg-slate-100 text-slate-800',
  primary:     'bg-blue-100 text-blue-800',
  success:     'bg-green-100 text-green-800',
  warning:     'bg-amber-100 text-amber-800',
  destructive: 'bg-red-100 text-red-800',
  outline:     'border border-slate-200 text-slate-700',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: keyof typeof variants
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variants[variant], className)} {...props} />
  )
}
