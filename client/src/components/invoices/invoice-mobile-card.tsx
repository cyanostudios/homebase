import type { Invoice, RefereeAssignment, Referee } from "@shared/schema";
import { RefereeStatus } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/date-utils";
import { useTimeFormat } from "@/context/time-format-context";
import { useDateFormat } from "@/context/date-format-context";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

interface InvoiceMobileCardProps {
  invoice: Invoice;
  onClick: (invoice: Invoice) => void;
  onNotifyClick?: (e: React.MouseEvent, assignmentId: number) => void;
}

export function InvoiceMobileCard({ invoice, onClick, onNotifyClick }: InvoiceMobileCardProps) {
  const { timeFormat } = useTimeFormat();
  const { dateFormat } = useDateFormat();

  // Fetch assignments for this invoice
  const { data: assignments } = useQuery<(RefereeAssignment & { referee?: Referee })[]>({
    queryKey: [`/api/invoices/${invoice.id}/assignments`],
  });

  // Process assignments with referee data
  const refereeAssignments = useMemo(() => {
    if (!assignments || assignments.length === 0) {
      return [];
    }

    return assignments
      .filter(a => a.referee)
      .map(a => ({
        ...a,
        referee: a.referee
      }));
  }, [assignments, invoice.id]);

  return (
    <div 
      className="bg-white p-3 rounded-lg border border-neutral-200 shadow-sm mb-2 cursor-pointer"
      onClick={() => onClick(invoice)}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="font-semibold text-sm">
          {invoice.homeTeam} <span className="text-neutral-400">vs</span> {invoice.awayTeam}
        </div>
      </div>

      <div className="text-xs text-neutral-500 mb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span>{formatDateTime(invoice.dateTime, timeFormat, dateFormat)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>{invoice.venue}</span>
          </div>
        </div>
      </div>

      {refereeAssignments.length > 0 ? (
        <div className="border-t border-neutral-100 pt-2 mt-2">
          <div className="text-xs font-medium mb-1">Assigned Referees:</div>
          {refereeAssignments.map((assignment) => (
            <div key={assignment.id} className="flex justify-between items-center py-1">
              <div className="flex items-center text-sm">
                {assignment.status === RefereeStatus.ASSIGNED ? (
                  <div className="status-dot bg-green-500 mr-2.5" title="Assigned"></div>
                ) : assignment.status === RefereeStatus.NOTIFIED ? (
                  <div className="status-dot bg-orange-500 mr-2.5" title="Notified"></div>
                ) : assignment.status === RefereeStatus.NOT_NOTIFIED ? (
                  <div className="status-dot bg-amber-400 mr-2.5" title="Not Notified"></div>
                ) : assignment.status === RefereeStatus.DECLINED ? (
                  <div className="status-dot bg-red-600 mr-2.5" title="Declined"></div>
                ) : (
                  <div className="status-dot bg-neutral-300 mr-2.5" title="Not Assigned"></div>
                )}
                {assignment.referee?.fullName}
                <span className="text-xs text-neutral-500 ml-1">({assignment.role.replace("_", " ")})</span>
              </div>

              {assignment.status === RefereeStatus.NOT_NOTIFIED && onNotifyClick && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="text-xs h-7 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNotifyClick(e, assignment.id);
                  }}
                >
                  Notify
                </Button>
              )}

              <StatusBadge status={assignment.status as RefereeStatus} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-neutral-500 border-t border-neutral-100 pt-2 mt-2">
          No referees assigned
        </div>
      )}
    </div>
  );
}