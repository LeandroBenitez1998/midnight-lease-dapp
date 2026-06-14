import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none tracking-[0.02em]',
  {
    variants: {
      variant: {
        outline: 'border-border bg-white text-foreground',
        solid: 'border-black bg-black text-white',
        subtle: 'border-border bg-muted text-foreground',
      },
    },
    defaultVariants: {
      variant: 'outline',
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />
}

export { Badge }
