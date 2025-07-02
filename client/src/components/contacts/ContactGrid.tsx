import { useQuery } from "@tanstack/react-query";
import type { Contact } from "@shared/schema";
import { useApp } from "@/context/app-context";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Eye } from "lucide-react";

// Component for displaying a single contact row in the table
interface ContactRowProps {
  contact: Contact;
  onClick: () => void;
}

function ContactRow({ contact, onClick }: ContactRowProps) {
  const contactPersons = (contact.contactPersons || []) as Contact['contactPersons'];

  const displayName = contact.companyName || contact.fullName;
  return (
    <tr
      className="hover:bg-neutral-50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <td className="px-4 py-3 text-sm">
        <div className="flex flex-col">
          <span className="font-medium">{displayName}</span>
          <span className="text-xs text-neutral-500">
            {contact.organizationNumber || '-'}
          </span>
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        {contactPersons.length === 0 ? (
          <span className="text-neutral-500">-</span>
        ) : (
          <div className="flex flex-col space-y-1">
{Array.isArray(contactPersons) ? contactPersons.map((p, idx) => (
  <span key={idx}>{`${p.firstName} ${p.lastName}`}</span>
)) : null}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-neutral-500">-</td>
      <td className="px-4 py-3 text-center">
        <Button variant="subtleGray" size="sm" className="px-2 py-1">
          <Eye className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

// Mobile card component for contacts
function ContactMobileCard({ contact, onClick }: { contact: Contact; onClick: () => void }) {
  const contactPersons = (contact.contactPersons || []) as Contact['contactPersons'];
  const displayName = contact.companyName || contact.fullName;

  return (
    <div
      className="bg-white rounded-lg border border-neutral-200 p-4 mb-3 hover:bg-neutral-50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="mb-2">
        <h4 className="font-medium">{displayName}</h4>
        <p className="text-xs text-neutral-500">
          {contact.organizationNumber || '-'}
        </p>
      </div>
      <div className="mb-3">
        {contactPersons.length === 0 ? (
          <span className="text-sm text-neutral-500">-</span>
        ) : (
          <div className="space-y-1 text-sm">
            {contactPersons.map((p, idx) => (
              <div key={idx}>{`${p.firstName} ${p.lastName}`}</div>
            ))}
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <Button variant="subtleGray" size="sm" className="px-2 py-1">
          <Eye className="h-4 w-4" />
        </Button>
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
  const itemsPerPage = 10;

  // All hooks must be called before any conditional returns
  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });

  

  // Handle sort toggle
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  const handleSortToggle = () => {
    toggleSortDirection();
  };

  // Process contacts for filtering and sorting
  const processedContacts = useMemo(() => {
    if (!contacts) return [];

    let filteredContacts = [...contacts];

    // Apply name filter
    if (nameFilter.trim()) {
      const filter = nameFilter.toLowerCase();
      filteredContacts = filteredContacts.filter(contact => {
        const name = (contact.companyName || contact.fullName || '').toLowerCase();
        const org = (contact.organizationNumber || '').toLowerCase();
        return name.includes(filter) || org.includes(filter);
      });
    }

    // Sort by name
    return filteredContacts.sort((a, b) => {
      const nameA = (a.companyName || a.fullName || '').toLowerCase();
      const nameB = (b.companyName || b.fullName || '').toLowerCase();
      return sortDirection === 'asc'
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    });
  }, [contacts, sortDirection, nameFilter]);

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
                onClick={handleSortToggle}
              >
                <div className="flex items-center">
                  <span>Company Info</span>
                  {sortDirection === 'asc' ? (
                    <ChevronUp className="h-4 w-4 ml-1" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th className="px-4 py-3 font-medium text-left">Contact Persons</th>
              <th className="px-4 py-3 font-medium text-left">Invoices</th>
              <th className="px-4 py-3 font-medium text-center w-12">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {paginatedContacts.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-neutral-500">
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