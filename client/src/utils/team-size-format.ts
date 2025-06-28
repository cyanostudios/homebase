// Team Size Format utility functions
// Uses structured format in match description to store team size information

export const TEAM_SIZE_FORMATS = ["fullsize", "small", "mini", "futsal", "street", "individual"] as const;

export type TeamSizeFormat = typeof TEAM_SIZE_FORMATS[number];

const TEAM_SIZE_PREFIX = "[TEAM_SIZE:";
const TEAM_SIZE_SUFFIX = "]";

/**
 * Extracts team size format from match description
 * Format: [TEAM_SIZE:11v11] at the beginning of description
 */
export function extractTeamSizeFormat(description?: string | null): string {
  if (!description) return "fullsize";
  
  const match = description.match(/^\[TEAM_SIZE:([^\]]+)\]/);
  if (match && match[1]) {
    return match[1]; // Return the actual format value (e.g., "11v11", "7v7")
  }
  
  return "fullsize"; // Default fallback
}

/**
 * Embeds team size format into match description
 * Format: [TEAM_SIZE:11v11] description content
 */
export function embedTeamSizeFormat(description: string | undefined, format: string): string {
  // Remove existing team size format if present
  const cleanDescription = description ? description.replace(/^\[TEAM_SIZE:[^\]]+\]\s*/, "") : "";
  
  // Add new format prefix
  return `${TEAM_SIZE_PREFIX}${format}${TEAM_SIZE_SUFFIX} ${cleanDescription}`.trim();
}

/**
 * Gets the display label for a team size format
 */
export function getTeamSizeFormatLabel(format: string): string {
  const formatStr = format || "fullsize";
  
  // Handle specific team size formats
  if (formatStr.includes('v')) {
    // For formats like "11v11", "7v7", etc.
    return formatStr.toUpperCase();
  }
  
  // For other formats, capitalize first letter
  return formatStr.charAt(0).toUpperCase() + formatStr.slice(1);
}

/**
 * Removes team size format from description for display
 */
export function getCleanDescription(description?: string | null): string {
  if (!description) return "";
  return description.replace(/^\[TEAM_SIZE:[^\]]+\]\s*/, "");
}