import { AppContainer } from "@/components/layout/app-container";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { InvoiceTable } from "@/components/invoices/invoice-table";

export default function Dashboard() {
  return (
    <AppContainer>
      <div className="space-y-4">
        {/* Stats cards */}
        <StatsCards />

        {/* Upcoming Invoices */}
        <div className="bg-white shadow-sm mb-6">
            <div className="p-4">
              <h3 className="font-semibold">Upcoming Invoices</h3>
            </div>

            <InvoiceTable />
          </div>

          {/* Recent Activity */}
        <ActivityFeed />
      </div>
    </AppContainer>
  );
}