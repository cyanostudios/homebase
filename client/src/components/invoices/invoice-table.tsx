import { useQuery } from "@tanstack/react-query";
import type { Invoice, ContactAssignment, Contact } from "@shared/schema";
import { ContactStatus } from "@shared/schema";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApp } from "@/context/app-context";
import React, { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { InvoiceMobileCard } from "./invoice-mobile-card";
import { formatDateTime, formatTime } from "@/lib/date-utils";
import { useTimeFormat } from "@/context/time-format-context";
import { useDateFormat } from "@/context/date-format-context";
import { format, isPast, isFuture, parseISO, compareAsc, compareDesc } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ChevronUp, ChevronDown, Eye } from "lucide-react";
import { extractTeamSizeFormat, getTeamSizeFormatLabel } from "@/utils/team-size-format";
import { useCity } from "@/context/city-context";

// Component for displaying a single invoice row in the table
interface InvoiceRowProps {
  invoice: any; // Allow both Date and string types for dateTime
  onClick: () => void;
  onNotifyClick?: (e: React.MouseEvent, assignmentId: number) => void;
}

function InvoiceRow({ invoice, onClick, onNotifyClick }: InvoiceRowProps) {
  const { timeFormat } = useTimeFormat();
  const { dateFormat } = useDateFormat();
  const { data: assignments } = useQuery<(RefereeAssignment & { referee?: Referee })[]>({
    queryKey: [`/api/invoices/${invoice.id}/assignments`],
  });

  const invoiceDate = new Date(invoice.dateTime);

  // Format date as "Wed 21 May 2025"
  const formattedDate = format(invoiceDate, "EEE dd MMM yyyy");

  // Format time based on user's preference (12h/24h)
  const formattedTime = timeFormat === '12h' 
    ? format(invoiceDate, "h:mm a") 
    : format(invoiceDate, "HH:mm");

  // Combine date and time for display
  const dateTimeDisplay = `${formattedDate} ${formattedTime}`;

  // Get assignments with referee data
  const refereeAssignments = useMemo(() => {
    if (!assignments || assignments.length === 0) {
      return [];
    }

    // Get assignments with referee data and ensure status is properly mapped
    return assignments
      .filter(a => a.referee)
      .map(a => {
        // Make sure we have the correct status enum value
        let status = a.status;
        // If status is a string, convert it to the proper enum value
        if (typeof status === 'string') {
          status = status as RefereeStatus;
        }

        return {
          id: a.id,
          name: a.referee?.fullName || '',
          status: status
        };
      });
  }, [assignments, invoice.id]);

  // Determine game format display
  const formatDisplay = useMemo(() => {
    const parts = [];
    if (invoice.team) {
      parts.push(invoice.team.toUpperCase());
    }
    if (invoice.category) {
      parts.push(invoice.category);
    }
    return parts.join(", ") || "—";
  }, [invoice]);

  return (
    <tr
      className="hover:bg-neutral-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      {/* Date & Time */}
      <td className="px-4 py-3 text-sm">
        <div className="font-medium">
          <div className="sm:hidden">
            <div className="text-xs">{format(invoiceDate, "dd MMM")}</div>
            <div className="text-xs text-neutral-500">{formattedTime}</div>
          </div>
          <div className="hidden sm:block text-sm">{dateTimeDisplay}</div>
        </div>
      </td>
      
      {/* Teams */}
      <td className="px-4 py-3 text-sm">
        <div className="font-medium">
          <div className="sm:hidden">
            <div className="text-sm">{invoice.homeTeam}</div>
            <div className="text-xs text-neutral-500">vs {invoice.awayTeam}</div>
          </div>
          <div className="hidden sm:block">{invoice.homeTeam} vs {invoice.awayTeam}</div>
        </div>
      </td>
      
      {/* Venue */}
      <td className="px-4 py-3 text-xs hidden md:table-cell">
        <div className="text-neutral-700">{invoice.venue || "—"}</div>
        {invoice.city && <div className="text-neutral-500 mt-0.5">{invoice.city}</div>}
      </td>
      
      {/* Invoice Category */}
      <td className="px-4 py-3 text-xs hidden lg:table-cell">
        <span className="text-neutral-700 font-medium">
          {invoice.category || "—"}
        </span>
      </td>
      
      {/* Team Category */}
      <td className="px-4 py-3 text-xs hidden lg:table-cell">
        <span className="text-neutral-700 font-medium">
          {invoice.team ? (
            `${invoice.team.toUpperCase()}, ${getTeamSizeFormatLabel(extractTeamSizeFormat(invoice.description))}`
          ) : (
            "—"
          )}
        </span>
      </td>
      
      {/* Referee */}
      <td className="px-4 py-3 text-xs">
        <div className="flex flex-col space-y-1">
          {refereeAssignments.length === 0 ? (
            <div className="flex items-center">
              <div className="status-dot bg-neutral-300 mr-2"></div>
              <span className="text-neutral-500">No referees assigned</span>
            </div>
          ) : (
            refereeAssignments.map(ref => (
              <div key={ref.id} className="flex items-center">
                {/* Status color dot - perfectly round indicators */}
                {ref.status === RefereeStatus.ASSIGNED ? (
                  <div className="status-dot bg-green-500 mr-2.5" title="Assigned"></div>
                ) : ref.status === RefereeStatus.NOTIFIED ? (
                  <div className="status-dot bg-orange-500 mr-2.5" title="Notified"></div>
                ) : ref.status === RefereeStatus.NOT_NOTIFIED ? (
                  <div className="status-dot bg-amber-400 mr-2.5" title="Not Notified"></div>
                ) : ref.status === RefereeStatus.DECLINED ? (
                  <div className="status-dot bg-red-600 mr-2.5" title="Declined"></div>
                ) : (
                  <div className="status-dot bg-neutral-300 mr-2.5" title="Not Assigned"></div>
                )}
                <span className={`${ref.status === ContactStatus.NOT_ASSIGNED ? "text-neutral-500" : ""}`}>{ref.name}</span>
              </div>
            ))
          )}
        </div>
      </td>
      
      {/* View */}
      <td className="px-4 py-3 text-center">
        <Button variant="subtleGray" size="sm" className="px-2 py-1">
          <Eye className="h-4 w-4 mr-1" />
          <span>View</span>
        </Button>
      </td>
    </tr>
  );
}

export function InvoiceTable() {
  const { openInvoicePanel, notifyReferee, isInvoiceInEditMode, isRefereeInEditMode } = useApp();
  const isMobile = useIsMobile();
  const { timeFormat } = useTimeFormat();

  // State for filtering, sorting, and pagination
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past' | 'all'>('upcoming');
  const [page, setPage] = useState(1);
  const [searchFilter, setSearchFilter] = useState('');
  const itemsPerPage = 10;

  // API data fetching - must come before conditional returns
  const { data: invoices, isLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
  });

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value as 'upcoming' | 'past' | 'all');
    setPage(1); // Reset to first page when changing tabs
  };

  // Handle sort toggle
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Handlers
  const handleRowClick = (invoice: any) => {
    // Prevent navigation when in edit mode
    if (isInvoiceInEditMode || isRefereeInEditMode) {
      return;
    }
    openInvoicePanel(invoice);
  };

  const handleNotifyClick = (e: React.MouseEvent, assignmentId: number) => {
    e.stopPropagation();
    notifyReferee(assignmentId);
  };

  // Process invoices for filtering and sorting
  const processedInvoices = useMemo(() => {
    if (!invoices) return [];

    // Filter by tab selection
    let filteredInvoices = [...invoices];
    if (activeTab === 'upcoming') {
      filteredInvoices = invoices.filter(invoice => {
        const invoiceDate = invoice.dateTime instanceof Date ? invoice.dateTime : parseISO(invoice.dateTime);
        return isFuture(invoiceDate);
      });
    } else if (activeTab === 'past') {
      filteredInvoices = invoices.filter(invoice => {
        const invoiceDate = invoice.dateTime instanceof Date ? invoice.dateTime : parseISO(invoice.dateTime);
        return isPast(invoiceDate);
      });
    }

    // Apply search filter
    if (searchFilter.trim()) {
      filteredInvoices = filteredInvoices.filter(invoice => 
        invoice.homeTeam.toLowerCase().includes(searchFilter.toLowerCase()) ||
        invoice.awayTeam.toLowerCase().includes(searchFilter.toLowerCase()) ||
        invoice.venue.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (invoice.city && invoice.city.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (invoice.description && invoice.description.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (invoice.category && invoice.category.toLowerCase().includes(searchFilter.toLowerCase()))
      );
    }

    // Sort by date
    return filteredInvoices.sort((a, b) => {
      const dateA = a.dateTime instanceof Date ? a.dateTime : parseISO(a.dateTime);
      const dateB = b.dateTime instanceof Date ? b.dateTime : parseISO(b.dateTime);

      return sortDirection === 'asc' 
        ? compareAsc(dateA, dateB) 
        : compareDesc(dateA, dateB);
    });
  }, [invoices, activeTab, sortDirection, searchFilter]);



  // Apply pagination
  const paginatedInvoices = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return processedInvoices.slice(startIndex, startIndex + itemsPerPage);
  }, [processedInvoices, page, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil((processedInvoices?.length || 0) / itemsPerPage);
  }, [processedInvoices, itemsPerPage]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="p-4 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Render empty state
  if (!invoices || invoices.length === 0) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-medium text-neutral-500">No invoices found</h3>
        <p className="text-neutral-400 mt-1">Add an invoice to get started</p>
      </div>
    );
  }

  // Render mobile layout
  if (isMobile) {
    return (
      <div className="px-2 py-2">
        <Tabs defaultValue="upcoming" onValueChange={handleTabChange} className="mb-4">
          <TabsList className="w-full grid grid-cols-3 h-10">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search filter */}
        <div className="mb-4">
          <Input
            placeholder="Search invoices..."
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value);
              setPage(1); // Reset to first page when filtering
            }}
            className="w-full"
          />
        </div>

        {paginatedInvoices.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            No invoices found for this filter
          </div>
        ) : (
          <>
            {paginatedInvoices.map((invoice) => (
              <InvoiceMobileCard
                key={invoice.id}
                invoice={invoice}
                onClick={() => handleRowClick(invoice)}
                onNotifyClick={handleNotifyClick}
              />
            ))}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4 px-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex-1 max-w-24"
                >
                  Previous
                </Button>
                <span className="py-2 px-4 text-sm font-medium">
                  {page} / {totalPages}
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex-1 max-w-24"
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // Desktop layout with responsive horizontal scrolling
  return (
    <div className="space-y-3">
      {/* Combined filter controls - tabs and search in same area */}
      <div className="bg-white rounded-md p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <Tabs defaultValue="upcoming" onValueChange={handleTabChange}>
            <TabsList>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Input
            placeholder="Search invoices..."
            value={searchFilter}
            onChange={(e) => {
              setSearchFilter(e.target.value);
              setPage(1); // Reset to first page when filtering
            }}
            className="w-full max-w-md"
          />
        </div>
      </div>

      <div className="bg-white rounded-md">
        <div className="overflow-x-auto rounded-md">
          <table className="w-full">
          <thead className="bg-[#3a606e]/5 text-xs text-[#3a606e] uppercase">
            <tr>
              <th 
                className="px-4 py-3 font-medium text-left cursor-pointer"
                onClick={toggleSortDirection}
              >
                <div className="flex items-center">
                  <span className="hidden sm:inline">Date & Time</span>
                  <span className="sm:hidden">Date</span>
                  {sortDirection === 'asc' ? (
                    <ChevronUp className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 font-medium text-left">Teams</th>
              <th className="px-4 py-3 font-medium text-left hidden md:table-cell">Venue</th>
              <th className="px-4 py-3 font-medium text-left hidden lg:table-cell">Invoice Category</th>
              <th className="px-4 py-3 font-medium text-left hidden lg:table-cell">Team Category</th>
              <th className="px-4 py-3 font-medium text-left">Referee</th>
              <th className="px-4 py-3 font-medium text-center w-12">View</th>
            </tr>
            </thead>
          <tbody className="divide-y divide-neutral-100">
            {paginatedInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-neutral-500">
                  No invoices found for this filter
                </td>
              </tr>
            ) : (
              paginatedInvoices.map((invoice) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  onClick={() => handleRowClick(invoice)}
                  onNotifyClick={handleNotifyClick}
                />
              ))
            )}
          </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex justify-center p-4 border-t border-neutral-200 gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="py-2 px-2 text-sm">
              Page {page} of {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}