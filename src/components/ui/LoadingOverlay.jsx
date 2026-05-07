import React from "react";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const LoadingOverlay = ({ isVisible, message = "Cargando información..." }) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-background/60 backdrop-blur-sm"
        >
          <div className="flex flex-col items-center gap-4 p-8 bg-card border border-border rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-16 w-16 rounded-full border-4 border-primary/10" />
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <div className="flex flex-col items-center gap-1">
              <p className="text-sm font-black text-foreground uppercase tracking-widest">{message}</p>
              <div className="flex gap-1">
                <motion.div
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                  className="h-1 w-1 rounded-full bg-primary"
                />
                <motion.div
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                  className="h-1 w-1 rounded-full bg-primary"
                />
                <motion.div
                  animate={{ scale: [1, 1.5, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                  className="h-1 w-1 rounded-full bg-primary"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const SkeletonLine = ({ className }) => (
  <div className={`animate-pulse bg-secondary rounded ${className}`} />
);

export const StatsSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-card border border-border rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-8 w-8 rounded-lg bg-secondary animate-pulse" />
          <div className="h-4 w-12 rounded-md bg-secondary animate-pulse" />
        </div>
        <div className="space-y-2">
          <div className="h-8 w-24 bg-secondary animate-pulse rounded" />
          <div className="h-3 w-16 bg-secondary animate-pulse rounded" />
        </div>
        <div className="h-8 w-full bg-secondary animate-pulse rounded-md" />
      </div>
    ))}
  </div>
);
