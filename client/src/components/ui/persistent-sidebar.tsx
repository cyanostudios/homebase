
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PersistentSidebarProps {
  isOpen: boolean;
  children: React.ReactNode;
  shouldAnimate: boolean;
  onClose: () => void;
  className?: string;
}

export function PersistentSidebar({ 
  isOpen, 
  children, 
  shouldAnimate, 
  onClose, 
  className 
}: PersistentSidebarProps) {
  return (
    <div className={cn(
      "fixed inset-0 z-50 pointer-events-none",
      isOpen && "pointer-events-auto"
    )}>
      {/* Persistent sidebar container */}
      <div className="absolute top-0 right-0 w-full sm:w-[550px] h-full pointer-events-none">
        <AnimatePresence mode="wait">
          {isOpen && (
            <motion.div
              key="sidebar-content"
              initial={shouldAnimate ? { x: "100%" } : false}
              animate={{ x: 0 }}
              exit={shouldAnimate ? { x: "100%" } : false}
              transition={{ 
                type: "tween", 
                duration: 0.3, 
                ease: [0.32, 0.72, 0, 1] 
              }}
              className={cn(
                "h-full bg-white shadow-lg overflow-y-auto custom-scrollbar pointer-events-auto",
                className
              )}
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
