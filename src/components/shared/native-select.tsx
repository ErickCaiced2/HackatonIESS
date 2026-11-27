"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";

export interface NativeSelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  wrapperClassName?: string;
}

export const NativeSelect = React.forwardRef<
  HTMLSelectElement,
  NativeSelectProps
>(({ className, wrapperClassName, children, ...props }, ref) => {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        ref={ref}
        className={cn(
          "flex h-10 w-full appearance-none rounded-lg border border-slate-300 bg-white py-2 pr-9 pl-3 text-sm text-slate-900 shadow-xs transition-colors",
          "hover:border-slate-400 focus-visible:border-[#004B87] focus-visible:ring-3 focus-visible:ring-[#004B87]/20 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-75",
          "aria-invalid:border-red-500 aria-invalid:ring-red-500/20",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-slate-500"
      />
    </div>
  );
});

NativeSelect.displayName = "NativeSelect";
