import React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { getStatusColor } from "@/lib/status-colors";
import { ContactStatus } from "@shared/schema";

interface StatusBadgeProps {
  status: ContactStatus | null | undefined;
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "dot" | "badge";
}

export function StatusBadge({
  status,
  className,
  size = "md",
  variant = "badge",
}: StatusBadgeProps) {
  const statusColors = getStatusColor(status);

  const getStatusText = () => {
    if (!status) return "Unassigned";
    
    switch (status) {
      case ContactStatus.NOT_ASSIGNED:
        return "Not Assigned";
      case ContactStatus.NOT_NOTIFIED:
        return "Not Notified";
      case ContactStatus.NOTIFIED:
        return "Notified";
      case ContactStatus.ASSIGNED:
        return "Assigned";
      case ContactStatus.DECLINED:
        return "Declined";
      default:
        return "Unknown";
    }
  };

  const getSizeClasses = () => {
    // For dot variant, show just a dot
    if (variant === "dot") {
      switch (size) {
        case "sm": return "w-3 h-3";
        case "md": return "w-4 h-4";
        case "lg": return "w-5 h-5";
        default: return "w-4 h-4";
      }
    } else {
      // For badge variant, use responsive text sizing
      switch (size) {
        case "sm": return "text-[10px] px-1.5 py-0.5";
        case "md": return "text-[10px] sm:text-xs px-1.5 py-0.5";
        case "lg": return "text-xs px-2 py-0.5";
        default: return "text-[10px] sm:text-xs px-1.5 py-0.5";
      }
    }
  };

  // Always show dot for dot variant
  if (variant === "dot") {
    return (
      <span
        className={cn(
          "inline-block rounded-full flex-shrink-0",
          statusColors.badge,
          getSizeClasses(),
          className
        )}
      />
    );
  }

  // Regular badge with text for all device sizes
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium",
        statusColors.badge,
        getSizeClasses(),
        className
      )}
      style={{ borderRadius: '6px' }}
    >
      {getStatusText()}
    </span>
  );
}

export function AvailabilityBadge({
  availability,
  className,
}: {
  availability: string;
  className?: string;
}) {
  const getStatusColor = () => {
    switch (availability) {
      case "AVAILABLE":
        return "bg-green-100 text-green-800";
      case "LIMITED":
        return "bg-yellow-100 text-yellow-800";
      case "BUSY":
        return "bg-orange-100 text-orange-800";
      case "UNAVAILABLE":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = () => {
    switch (availability) {
      case "AVAILABLE":
        return "Available";
      case "LIMITED":
        return "Limited";
      case "BUSY":
        return "Busy";
      case "UNAVAILABLE":
        return "Unavailable";
      default:
        return "Unknown";
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center text-xs px-2 py-1 font-medium",
        getStatusColor(),
        className
      )}
      style={{ borderRadius: '6px' }}
    >
      {getStatusText()}
    </span>
  );
}