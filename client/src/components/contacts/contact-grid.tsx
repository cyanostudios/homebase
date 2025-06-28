import { useQuery } from "@tanstack/react-query";
import { Contact, ContactAvailability, ContactAssignment, Invoice } from "@/lib/types";
import { AvailabilityBadge } from "@/components/ui/status-badge";
import { useApp } from "@/context/app-context";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronUp, ChevronDown, Eye } from "lucide-react";
import { useTimeFormat } from "@/context/time-format-context";
import { useDateFormat } from "@/context/date-format-context";
import { formatDateTime } from "@/lib/date-utils";

// Component for displaying a single contact row in the table
interface ContactRowProps {
  contact: Contact;
  onClick: () => void;
}

function ContactRow({ contact, onClick }: ContactRowProps) {
  const { timeFormat } = useTimeFormat();
  const { dateFormat } = useDateFormat();
  const { data: assignments } = useQuery<(ContactAssignment & { invoice?: Invoice })[]>({
    queryKey: [`/api/contacts/${contact.id}/assignments`],
  });

  // Get active assignments for this contact
  const activeAssignments = useMemo(() => {
    if (!assignments || assignments.length === 0) {
      return [];
    }

    // Get upcoming assignments - only show NOTIFIED or ASSIGNED
    return assignments
      .filter(a => 
        a.invoice && 
        new Date(a.invoice.dateTime) > new Date() &&
        (a.status === "NOTIFIED" || a.status === "ASSIGNED")
      )
      .slice(0, 3) // Show max 3 upcoming assignments
      .map(a => {
        const invoiceDate = a.invoice?.dateTime ? formatDateTime(a.invoice.dateTime, timeFormat, dateFormat) : '';

        return {
          id: a.id,
          invoiceInfo: `${invoiceDate} ${a.invoice?.homeTeam} vs ${a.invoice?.awayTeam}`,
          status: a.status
        };
      });
  }, [assignments, timeFormat]);

  // Format qualifications display
  const qualificationDisplay = useMemo(() => {
    const parts = [];
    if (contact.qualificationLevel === "FIFA") {
      parts.push("FIFA Certified");
    } else if (contact.qualificationLevel === "NATIONAL") {
      parts.push("National Level");
    } else {
      parts.push("Regional Level");
    }
    return parts.join(", ") || "—";
  }, [contact]);

  return (
    <tr
      className="hover:bg-neutral-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center overflow-hidden">
            <span className="material-icons text-neutral-500 text-sm">person</span>
          </div>
          <div>
            <div className="font-medium">{contact.fullName}</div>
            <div className="text-xs text-neutral-500">{contact.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-sm whitespace-nowrap">
        <div className="px-2 py-1 inline-flex items-center justify-center rounded-md bg-neutral-100 text-neutral-800 text-xs font-medium">
          {qualificationDisplay}
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-wrap gap-1">
          {(contact.specializations || []).slice(0, 3).map((spec, index) => (
            <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5" style={{ borderRadius: '6px' }}>
              {spec}
            </span>
          ))}
          {(contact.specializations || []).length > 3 && (
            <span className="text-neutral-500 text-xs">+{(contact.specializations || []).length - 3} more</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-col space-y-1">
          {activeAssignments.length === 0 ? (
            <div className="flex items-center">
              <div className="status-dot bg-neutral-300 mr-2"></div>
              <span className="text-neutral-500">No upcoming assignments</span>
            </div>
          ) : (
            activeAssignments.map(assignment => (
              <div key={assignment.id} className="flex items-center">
                <div className={`status-dot mr-2 ${
                  assignment.status === 'ASSIGNED' ? 'bg-green-500' :
                  assignment.status === 'NOTIFIED' ? 'bg-orange-500' :
                  assignment.status === 'NOT_NOTIFIED' ? 'bg-amber-400' :
                  assignment.status === 'DECLINED' ? 'bg-red-600' :
                  'bg-neutral-300'
                }`}></div>
                <span className="text-xs truncate max-w-[200px]">{assignment.invoiceInfo}</span>
              </div>
            ))
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <button className="text-primary-600 hover:text-primary-800 transition-colors">
          <Eye className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// Mobile card component for contacts
function ContactMobileCard({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const { data: assignments } = useQuery<(ContactAssignment & { invoice?: Invoice })[]>({
    queryKey: [`/api/contacts/${contact.id}/assignments`],
  });

  const upcomingAssignments = assignments?.filter(a => 
    a.invoice && new Date(a.invoice.dateTime) > new Date()
  ).length || 0;

  return (
    <div 
      className="bg-white rounded-lg border border-neutral-200 p-4 mb-3 hover:bg-neutral-50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center">
            <span className="material-icons text-neutral-500">person</span>
          </div>
          <div>
            <h4 className="font-medium">{contact.fullName}</h4>
            <p className="text-xs text-neutral-500">{contact.email}</p>
          </div>
        </div>
        <AvailabilityBadge availability={contact.availability} />
      </div>

      <div className="mb-3">
        <div className="text-xs text-neutral-500 mb-1">Qualification</div>
        <div className="px-2 py-1 inline-flex items-center justify-center rounded-md bg-neutral-100 text-neutral-800 text-xs font-medium">
          {contact.qualificationLevel === "FIFA" ? "FIFA Certified" :
           contact.qualificationLevel === "NATIONAL" ? "National Level" :
           "Regional Level"}
        </div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-neutral-500 mb-1">Specializations</div>
        <div className="flex flex-wrap gap-1">
          {(contact.specializations || []).slice(0, 3).map((spec, index) => (
            <span key={index} className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5" style={{ borderRadius: '6px' }}>
              {spec}
            </span>
          ))}
          {(contact.specializations || []).length > 3 && (
            <span className="text-neutral-500 text-xs">+{(contact.specializations || []).length - 3} more</span>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-neutral-500">
        <span>{upcomingAssignments} upcoming assignments</span>
        <Eye className="h-4 w-4" />
      </div>
    </div>
  );
}

export function ContactGrid() {
  const { openContactPanel, isInvoiceInEditMode, isContactInEditMode } = useApp();
  const isMobile = useIsMobile();
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [nameFilter, setNameFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'qualification'>('name');
  const itemsPerPage = 10;

  // All hooks must be called before any conditional returns
  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });

  

  // Handle sort toggle
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  // Handle sort by column
  const handleSortBy = (column: 'name' | 'qualification') => {
    if (sortBy === column) {
      toggleSortDirection();
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  // Process contacts for filtering and sorting
  const processedContacts = useMemo(() => {
    if (!contacts) return [];

    let filteredContacts = [...contacts];

    // Apply name filter
    if (nameFilter.trim()) {
      filteredContacts = filteredContacts.filter(contact =>
        contact.fullName.toLowerCase().includes(nameFilter.toLowerCase()) ||
        contact.email.toLowerCase().includes(nameFilter.toLowerCase())
      );
    }

    // Sort by selected column
    return filteredContacts.sort((a, b) => {
      if (sortBy === 'name') {
        return sortDirection === 'asc' 
          ? a.fullName.localeCompare(b.fullName)
          : b.fullName.localeCompare(a.fullName);
      } else if (sortBy === 'qualification') {
        const getQualificationPriority = (level: string) => {
          switch (level) {
            case 'FIFA': return 3;
            case 'NATIONAL': return 2;
            case 'REGIONAL': return 1;
            default: return 0;
          }
        };
        
        const priorityA = getQualificationPriority(a.qualificationLevel);
        const priorityB = getQualificationPriority(b.qualificationLevel);
        
        return sortDirection === 'asc' 
          ? priorityA - priorityB
          : priorityB - priorityA;
      }
      return 0;
    });
  }, [contacts, sortDirection, nameFilter, sortBy]);

  // Apply pagination
  const paginatedContacts = useMemo(() => {
    const startIndex = (page - 1) * itemsPerPage;
    return processedContacts.slice(startIndex, startIndex + itemsPerPage);
  }, [processedContacts, page, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil((processedContacts?.length || 0) / itemsPerPage);
  }, [processedContacts, itemsPerPage]);

  // Render loading state
  if (isLoading) {
    return (
      <div className="p-4 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Render empty state
  if (!contacts || contacts.length === 0) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-medium text-neutral-500">No contacts found</h3>
        <p className="text-neutral-400 mt-1">Add a contact to get started</p>
      </div>
    );
  }

  // Render mobile layout
  if (isMobile) {
    return (
      <div className="px-2 py-2">
        {/* Filter controls */}
        <div className="mb-4">
          <Input
            placeholder="Filter by name or email..."
            value={nameFilter}
            onChange={(e) => {
              setNameFilter(e.target.value);
              setPage(1); // Reset to first page when filtering
            }}
            className="w-full"
          />
        </div>

        {paginatedContacts.length === 0 ? (
          <div className="text-center py-8 text-neutral-500">
            No contacts found for this filter
          </div>
        ) : (
          <>
            {paginatedContacts.map((contact) => (
              <ContactMobileCard
                key={contact.id}
                contact={contact}
                onClick={() => {
                  // Prevent navigation when in edit mode
                  if (isInvoiceInEditMode || isContactInEditMode) {
                    return;
                  }
                  openContactPanel(contact);
                }}
              />
            ))}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex justify-center mt-4 gap-2">
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
          </>
        )}
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="space-y-3">
      {/* Filter controls */}
      <div className="bg-white rounded-md p-4">
        <Input
          placeholder="Filter by name or email..."
          value={nameFilter}
          onChange={(e) => {
            setNameFilter(e.target.value);
            setPage(1); // Reset to first page when filtering
          }}
          className="w-full max-w-md"
        />
      </div>

      <div className="bg-white rounded-md">
        <div className="overflow-x-auto rounded-md">
          <table className="w-full">
          <thead className="bg-[#3a606e]/5 text-xs text-[#3a606e] uppercase">
            <tr>
              <th 
                className="px-4 py-3 font-medium text-left cursor-pointer"
                onClick={() => handleSortBy('name')}
              >
                <div className="flex items-center">
                  <span>Contact</span>
                  {sortBy === 'name' && (
                    sortDirection === 'asc' ? (
                      <ChevronUp className="h-4 w-4 ml-1" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-1" />
                    )
                  )}
                </div>
              </th>
              <th 
                className="px-4 py-3 font-medium text-left cursor-pointer"
                onClick={() => handleSortBy('qualification')}
              >
                <div className="flex items-center">
                  <span>Qualification</span>
                  {sortBy === 'qualification' && (
                    sortDirection === 'asc' ? (
                      <ChevronUp className="h-4 w-4 ml-1" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-1" />
                    )
                  )}
                </div>
              </th>
              <th className="px-4 py-3 font-medium text-left">Specializations</th>
              <th className="px-4 py-3 font-medium text-left">Assignments</th>
              <th className="px-4 py-3 font-medium text-center w-12">View</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {paginatedContacts.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-neutral-500">
                  No contacts found for this filter
                </td>
              </tr>
            ) : (
              paginatedContacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  onClick={() => {
                    // Prevent navigation when in edit mode
                    if (isInvoiceInEditMode || isContactInEditMode) {
                      return;
                    }
                    openContactPanel(contact);
                  }}
                />
              ))
            )}
          </tbody>
          </table>
        </div>
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-4 gap-2">
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
  );
}