import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export const Switch = ({ checked, onChange, label, className, disabled }) => {
  return (
    <label className={cn(
      "flex items-center gap-3 cursor-pointer group select-none",
      disabled && "opacity-50 cursor-not-allowed",
      className
    )}>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <motion.div
          className={cn(
            "w-11 h-6 rounded-full transition-colors duration-200",
            checked ? "bg-primary" : "bg-slate-200"
          )}
        />
        <motion.div
          animate={{ x: checked ? 22 : 2 }}
          initial={false}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
        />
      </div>
      {label && (
        <span className="text-sm font-black text-slate-700 uppercase tracking-widest group-hover:text-primary transition-colors">
          {label}
        </span>
      )}
    </label>
  );
};
