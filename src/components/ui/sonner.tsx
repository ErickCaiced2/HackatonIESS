"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-[#007A53]" />,
        info: <InfoIcon className="size-4 text-[#004B87]" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-600" />,
        error: <OctagonXIcon className="size-4 text-red-600" />,
        loading: <Loader2Icon className="size-4 animate-spin text-[#004B87]" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "rounded-xl border border-slate-200 bg-white text-slate-900 shadow-lg shadow-slate-900/5",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
