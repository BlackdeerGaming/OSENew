import React from 'react';
import { cn } from '@/lib/utils';

/**
 * ViewHeader — Shared minimal page header used across all views.
 *
 * Props:
 *   icon       — Lucide icon component
 *   title      — Page title (short)
 *   subtitle   — Optional description
 *   actions    — Optional JSX for right-side action buttons
 *   className  — Optional extra classes for the wrapper
 */
export default function ViewHeader({ icon: Icon, title, subtitle, actions, className }) {
  return (
    <div className={cn(
      "w-full border-b border-border bg-card px-6 py-4 flex items-center justify-between gap-4 print:hidden",
      className
    )}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 border border-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-foreground leading-tight truncate">{title}</h2>
          {subtitle && (
            <p className="text-[11.5px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
