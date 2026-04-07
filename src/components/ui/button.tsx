import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[linear-gradient(135deg,#fff1a8_0%,#f6aa5c_30%,#7c3aed_100%)] text-slate-950 shadow-[0_18px_40px_rgba(124,58,237,0.25)] hover:scale-[1.02]',
        secondary:
          'border border-white/15 bg-white/5 text-white hover:bg-white/10',
        ghost:
          'text-slate-200 hover:bg-white/10',
        danger:
          'border border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20',
      },
      size: {
        sm: 'h-9 px-4 text-xs uppercase tracking-[0.24em]',
        md: 'h-11 px-5',
        lg: 'h-12 px-6',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
