import { useApp } from "@/context/app-context";
import { Skeleton } from "@/components/ui/skeleton";

export function StatsCards() {
  const { dashboardStats, isLoadingStats } = useApp();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-6">
      <StatsCard
        title="Sent"
        value={dashboardStats?.sentInvoices}
        subtitle="Invoices sent"
        icon="send"
        iconColor="text-blue-500"
        isLoading={isLoadingStats}
        borderColor="border-blue-500"
      />

      <StatsCard
        title="Unpaid"
        value={dashboardStats?.unpaidInvoices}
        subtitle="Awaiting payment"
        icon="schedule"
        iconColor="text-yellow-500"
        isLoading={isLoadingStats}
        borderColor="border-yellow-500"
      />

      <StatsCard
        title="Overdue"
        value={dashboardStats?.overdueInvoices}
        subtitle="Requires follow-up"
        icon="error"
        iconColor="text-red-500"
        isLoading={isLoadingStats}
        borderColor="border-red-500"
      />
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value?: number;
  subtitle: string;
  icon: string;
  iconColor: string;
  isLoading: boolean;
  borderColor: string;
}

function StatsCard({ title, value, subtitle, icon, iconColor, isLoading, borderColor }: StatsCardProps) {
  // Map border colors to background colors
  const getBgColor = (borderColor: string) => {
    if (borderColor.includes('blue')) return 'bg-blue-50';
    if (borderColor.includes('green')) return 'bg-green-50';
    if (borderColor.includes('yellow')) return 'bg-yellow-50';
    if (borderColor.includes('red')) return 'bg-red-50';
    if (borderColor.includes('secondary')) return 'bg-purple-50';
    return 'bg-gray-50';
  };

  return (
    <div className={`${getBgColor(borderColor)} p-3 md:p-4 rounded-lg shadow-sm`}>
      <div className="flex items-center justify-between">
        <p className="text-neutral-600 text-xs md:text-sm font-medium leading-tight">{title}</p>
        <span className={`material-icons text-lg md:text-xl ${iconColor}`}>{icon}</span>
      </div>
      {isLoading ? (
        <Skeleton className="h-6 md:h-9 w-12 md:w-16 mt-1 md:mt-2" />
      ) : (
        <p className="text-lg md:text-xl font-semibold mt-1 md:mt-2 text-neutral-800">{value}</p>
      )}
      <p className="text-xs text-neutral-500 mt-1 leading-tight">{subtitle}</p>
    </div>
  );
}