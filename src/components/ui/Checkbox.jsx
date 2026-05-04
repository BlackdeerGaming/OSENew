import React from "react";
import { cn } from "@/lib/utils";

export const Checkbox = ({ checked, onChange, className, label, ...props }) => {
  return (
    <label className={cn("flex items-center gap-2 cursor-pointer group", className)}>
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border border-slate-300 bg-white transition-all checked:border-primary checked:bg-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          {...props}
        />
        <svg
          className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </div>
      {label && (
        <span className="text-sm font-bold text-slate-700 uppercase tracking-wider group-hover:text-primary transition-colors">
          {label}
        </span>
      )}
    </label>
  );
};
