"use client";

import * as React from "react";
import * as SwitchPrimitive from '@radix-ui/react-switch';

import { cn } from "./utils";

function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-[1.5rem] w-[2.75rem] shrink-0 items-center rounded-full border border-transparent transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:bg-[#3d3a3b] data-[state=checked]:bg-[#f4bf4f]",
        "focus-visible:ring-2 focus-visible:ring-[#f4bf4f]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1a1617]",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-white shadow-md ring-0 transition-transform",
          "data-[state=checked]:translate-x-[1.25rem] data-[state=unchecked]:translate-x-0.5",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
