import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium font-mono",
  {
    variants: {
      variant: {
        default: "bg-secondary text-foreground",
        up: "bg-up/12 text-up",
        down: "bg-down/12 text-down",
        yellow: "bg-yellow/12 text-yellow",
        outline: "border border-border text-t2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
