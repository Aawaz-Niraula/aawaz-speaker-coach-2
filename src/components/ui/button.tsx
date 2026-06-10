import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06060b] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-[linear-gradient(135deg,#a78bfa_0%,#f9a8d4_100%)] text-[#06060b] shadow-[0_14px_36px_rgba(167,139,250,0.30)] hover:shadow-[0_18px_46px_rgba(167,139,250,0.42)] hover:brightness-110',
        secondary:
          'border border-white/10 bg-white/5 text-[#f2efff] backdrop-blur-sm hover:border-white/20 hover:bg-white/10',
        ghost:
          'text-[#ddd6fe] hover:bg-white/10',
        danger:
          'border border-[#f87171]/30 bg-[#dc2626]/15 text-[#f87171] hover:bg-[#dc2626]/25',
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
