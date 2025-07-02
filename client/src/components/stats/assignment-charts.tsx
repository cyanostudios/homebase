import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface ClubAssignment {
  clubId: number;
  clubName: string;
  count: number;
}

interface ContactStats {
  contactId: number;
  contactName: string;
  totalAssignments: number;
  assignmentsByClub: ClubAssignment[];
}

export function ContactAssignmentCharts() {
  const { data: contactStats, isLoading } = useQuery<ContactStats[]>({
    queryKey: ['/api/stats/contact-assignments'],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!contactStats || contactStats.length === 0) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-medium text-neutral-500">No assignment data available</h3>
        <p className="text-neutral-400 mt-1">Assign contacts to invoices to see statistics</p>
      </div>
    );
  }

  // Prepare data for the bar chart - assignments by contact and club
  const chartData = contactStats.flatMap(stat => 
    stat.assignmentsByClub.map(clubStat => ({
      contactName: stat.contactName,
      clubName: clubStat.clubName,
      assignments: clubStat.count,
    }))
  );

  // Calculate total assignments by club for the second chart
  const clubTotals = contactStats.reduce((acc, stat) => {
    stat.assignmentsByClub.forEach(clubStat => {
      if (!acc[clubStat.clubName]) {
        acc[clubStat.clubName] = 0;
      }
      acc[clubStat.clubName] += clubStat.count;
    });
    return acc;
  }, {} as Record<string, number>);

  const clubTotalChartData = Object.entries(clubTotals).map(([clubName, assignments]) => ({
    clubName,
    assignments,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium mb-4">Contact Assignments by Club</h3>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="contactName" 
                angle={-45} 
                textAnchor="end"
                height={70}
                interval={0} 
              />
              <YAxis label={{ value: 'Assignments', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar 
                dataKey="assignments" 
                fill="#4f46e5"
                name="Number of Assignments" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium mb-4">Total Assignments by Club</h3>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={clubTotalChartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="clubName" />
              <YAxis label={{ value: 'Total Assignments', angle: -90, position: 'insideLeft' }} />
              <Tooltip />
              <Legend />
              <Bar 
                dataKey="assignments" 
                fill="#10b981" 
                name="Total Assignments"
                radius={[4, 4, 0, 0]} 
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}