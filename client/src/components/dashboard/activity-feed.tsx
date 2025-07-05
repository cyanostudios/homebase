import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Activity } from "@shared/schema";
import { ActivityType } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useTimeFormat } from "@/context/time-format-context";
import { useDateFormat } from "@/context/date-format-context";
import { formatDateTime, formatTime } from "@/lib/date-utils";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Trash2 } from "lucide-react";

export function ActivityFeed() {
  const { timeFormat } = useTimeFormat();
  const { dateFormat } = useDateFormat();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showAllActivities, setShowAllActivities] = useState(false);
  const { data: activities, isLoading } = useQuery<Activity[]>({
    queryKey: ['/api/activities'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const clearActivities = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/activities"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      toast({
        title: "Activities cleared",
        description: "All activity logs have been deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to clear activities",
        variant: "destructive",
      });
    },
  });

  // Sort activities by creation date (newest first) and limit to 5 if showAllActivities is false
  const displayedActivities = (activities && activities.length > 0) 
    ? (!showAllActivities 
        ? activities.sort((a, b) => new Date(b.createdAt || Date.now()).getTime() - new Date(a.createdAt || Date.now()).getTime()).slice(0, 5)
        : activities.sort((a, b) => new Date(b.createdAt || Date.now()).getTime() - new Date(a.createdAt || Date.now()).getTime()))
    : [];

  if (isLoading) {
    return (
      <div className="p-4 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-medium text-neutral-500">No recent activity</h3>
        <p className="text-neutral-400 mt-1">Activities will appear here as they happen</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-4 flex items-center justify-between">
        <h3 className="font-semibold">Recent Activity</h3>
        {activities && activities.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => clearActivities.mutate()}
            disabled={clearActivities.isPending}
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {clearActivities.isPending ? "Clearing..." : "Clear"}
          </Button>
        )}
      </div>

      <div className="divide-y divide-neutral-100">
        {displayedActivities.map((activity) => (
          <ActivityItem key={activity.id} activity={activity} />
        ))}
      </div>

      {activities.length > 5 && (
        <div className="p-3 border-t border-neutral-100 text-center">
          <Button 
            variant="ghost" 
            className="text-sm text-primary-600 hover:text-primary-700"
            onClick={() => setShowAllActivities(!showAllActivities)}
          >
            {showAllActivities ? "Show less" : "View more"}
          </Button>
        </div>
      )}
    </div>
  );
}

interface ActivityItemProps {
  activity: Activity;
}

function ActivityItem({ activity }: ActivityItemProps) {
  const { timeFormat } = useTimeFormat();

  const getActivityIcon = () => {
    switch (activity.activityType) {
      case ActivityType.NOTIFICATION_SENT:
        return { icon: "send", bgColor: "bg-green-100", textColor: "text-green-600" };
      case ActivityType.CONTACT_CREATED:
        return { icon: "person_add", bgColor: "bg-indigo-100", textColor: "text-indigo-600" };
      case ActivityType.CONTACT_UPDATED:
        return { icon: "person_add", bgColor: "bg-indigo-100", textColor: "text-indigo-600" };
      case ActivityType.INVOICE_CREATED:
        return { icon: "description", bgColor: "bg-blue-100", textColor: "text-blue-600" };
      case ActivityType.INVOICE_UPDATED:
        return { icon: "description", bgColor: "bg-blue-100", textColor: "text-blue-600" };
      default:
        return { icon: "info", bgColor: "bg-neutral-100", textColor: "text-neutral-600" };
    }
  };

  const { icon, bgColor, textColor } = getActivityIcon();
  const activityDate = new Date(activity.createdAt || Date.now());

  // Use the date utils functions for consistent formatting
  const formattedTime = formatTime(activityDate, timeFormat);

  // Use relative time (e.g., "2 hours ago") for the main display
  const timeAgo = formatDistanceToNow(activityDate, { addSuffix: true });

  return (
    <div className={`p-4 flex items-start space-x-4 ${
      'bg-neutral-50'
    }`}>
      <div className={`${textColor}`}>
        <span className="material-icons text-sm">{icon}</span>
      </div>
      <div className="flex-1">
        <p className="text-sm">{activity.description}</p>
        <p className="text-xs text-neutral-500 mt-1">
          {timeAgo} • {formattedTime}
        </p>
      </div>
    </div>
  );
}

function getActivityLabel(type: ActivityType): string {
  switch (type) {
    case ActivityType.CONTACT_CREATED:
      return "Contact Created";
    case ActivityType.CONTACT_UPDATED:
      return "Contact Updated";
    case ActivityType.NOTIFICATION_SENT:
      return "Notification Sent";
    case ActivityType.NOTIFICATION_READ:
      return "Notification Read";
    case ActivityType.INVOICE_CREATED:
      return "Invoice Created";
    case ActivityType.INVOICE_UPDATED:
      return "Invoice Updated";
    default:
      return "Activity";
  }
}