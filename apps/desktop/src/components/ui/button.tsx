import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Slot } from "radix-ui";

// The site's buttons, at desktop sizes: display face, cut corners on the filled ones, a gold gradient with a
// soft glow for the primary, a lift on hover.
const buttonVariants = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-transparent font-display font-semibold whitespace-nowrap transition-[transform,background,border-color,box-shadow,color] duration-200 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "btn-cut bg-linear-135 from-[#f0b232] to-primary text-primary-foreground shadow-[0_10px_24px_-12px_var(--accent)] hover:-translate-y-px hover:shadow-[0_14px_30px_-12px_var(--accent)] hover:brightness-105 active:translate-y-0",
        secondary:
          "btn-cut border-input bg-white/5 text-strong hover:-translate-y-px hover:border-white/20 hover:bg-white/9 active:translate-y-0 aria-expanded:bg-white/9",
        outline: "border-border bg-transparent text-foreground hover:bg-muted hover:text-strong aria-expanded:bg-muted",
        ghost:
          "text-muted-foreground hover:bg-muted hover:text-strong aria-expanded:bg-muted aria-expanded:text-strong",
        destructive:
          "btn-cut bg-destructive/12 text-[#f87171] hover:-translate-y-px hover:bg-destructive hover:text-white active:translate-y-0",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-5 text-sm",
        sm: "h-9 px-4 text-[13.5px]",
        xs: "h-7 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 px-6 text-[15px]",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-xs": "size-7 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
