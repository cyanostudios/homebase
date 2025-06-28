import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface ContactStats {
  contactId: number;
  contactName: string;
  totalAssignments: number;
  acceptedAssignments: number;
  declinedAssignments: number;
  acceptanceRate: number;
}

export default function Stats() {
  const { data: contactStats, isLoading } = useQuery<ContactStats[]>({
    queryKey: ['/api/stats/contact-assignments'],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-neutral-200 rounded"></div>
          <div className="h-64 bg-neutral-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!contactStats || contactStats.length === 0) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-neutral-500">No statistics available yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {contactStats.map((contact) => (
          <Card key={contact.contactId}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{contact.contactName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-600">Total Assignments:</span>
                  <span className="font-medium">{contact.totalAssignments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-600">Accepted:</span>
                  <span className="font-medium text-green-600">{contact.acceptedAssignments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-600">Declined:</span>
                  <span className="font-medium text-red-600">{contact.declinedAssignments}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-neutral-600">Acceptance Rate:</span>
                  <span className="font-medium">{(contact.acceptanceRate * 100).toFixed(1)}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact Assignment Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={contactStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="contactName" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="acceptedAssignments" fill="#22c55e" name="Accepted" />
                <Bar dataKey="declinedAssignments" fill="#ef4444" name="Declined" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}