import { ContactStatus, ContactAssignment } from "@shared/schema";

export interface StatusColorConfig {
  bg: string;
  hover: string;
  border: string;
  text: string;
  badge: string; // For badge component
}

export const STATUS_COLORS: Record<ContactStatus | 'UNASSIGNED', StatusColorConfig> = {
  [ContactStatus.NOT_ASSIGNED]: {
    bg: 'bg-red-500',
    hover: 'hover:bg-red-600',
    border: 'border-red-600',
    text: 'text-red-100',
    badge: 'bg-red-500 text-white'
  },
  [ContactStatus.NOT_NOTIFIED]: {
    bg: 'bg-yellow-500',
    hover: 'hover:bg-yellow-600',
    border: 'border-yellow-600',
    text: 'text-yellow-100',
    badge: 'bg-yellow-500 text-white'
  },
  [ContactStatus.NOTIFIED]: {
    bg: 'bg-orange-500',
    hover: 'hover:bg-orange-600',
    border: 'border-orange-600',
    text: 'text-orange-100',
    badge: 'bg-orange-500 text-white'
  },
  [ContactStatus.ASSIGNED]: {
    bg: 'bg-green-500',
    hover: 'hover:bg-green-600',
    border: 'border-green-600',
    text: 'text-green-100',
    badge: 'bg-green-500 text-white'
  },
  [ContactStatus.DECLINED]: {
    bg: 'bg-red-600',
    hover: 'hover:bg-red-700',
    border: 'border-red-700',
    text: 'text-red-100',
    badge: 'bg-red-600 text-white'
  },
  UNASSIGNED: {
    bg: 'bg-gray-400',
    hover: 'hover:bg-gray-500',
    border: 'border-gray-500',
    text: 'text-gray-100',
    badge: 'bg-gray-400 text-white'
  }
};

export function getStatusColor(status: ContactStatus | null | undefined): StatusColorConfig {
  if (!status) {
    return STATUS_COLORS.UNASSIGNED;
  }
  return STATUS_COLORS[status] || STATUS_COLORS.UNASSIGNED;
}

export function getMatchStatusColor(assignments: ContactAssignment[]): StatusColorConfig {
  if (!assignments || assignments.length === 0) {
    return STATUS_COLORS.UNASSIGNED;
  }

  // Check statuses in priority order: NOT_ASSIGNED -> NOT_NOTIFIED -> NOTIFIED -> ASSIGNED
  const statusPriority = [
    ContactStatus.NOT_ASSIGNED,
    ContactStatus.NOT_NOTIFIED, 
    ContactStatus.NOTIFIED,
    ContactStatus.ASSIGNED
  ];

  // Find the highest priority status among all assignments
  for (const status of statusPriority) {
    if (assignments.some(assignment => assignment.status === status)) {
      return STATUS_COLORS[status];
    }
  }

  // If only DECLINED assignments exist, show that
  if (assignments.some(assignment => assignment.status === ContactStatus.DECLINED)) {
    return STATUS_COLORS[ContactStatus.DECLINED];
  }

  return STATUS_COLORS.UNASSIGNED;
}

// Backwards compatibility - keeping the old function name for now
export const getMatchColor = getMatchStatusColor;