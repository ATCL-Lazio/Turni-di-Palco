import { cn } from "./utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-[#2c2c2e] animate-pulse rounded-lg", className)}
      {...props}
    />
  );
}

export { Skeleton };

