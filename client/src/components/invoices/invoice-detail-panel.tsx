import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Invoice, Contact, ContactAssignment, Activity } from "@shared/schema";
import { ActivityType, ContactStatus } from "@shared/schema";

import { useApp } from "@/context/app-context";
import { useViewMode } from "@/context/view-mode-context";
import { useTimeFormat } from "@/context/time-format-context";
import { useDateFormat } from "@/context/date-format-context";
import { useInvoiceCategories } from "@/context/invoice-categories-context";
import { useTeamCategories } from "@/context/team-categories-context";
import { useTeamSizeFormats } from "@/context/team-size-formats-context";
import { 
  extractTeamSizeFormat, 
  getTeamSizeFormatLabel, 
  getCleanDescription,
  embedTeamSizeFormat,
  type TeamSizeFormat 
} from "@/utils/team-size-format";
import { StatusBadge } from "@/components/ui/status-badge";
import { format, formatDistance, parseISO } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatTime, formatDateTime } from "@/lib/date-utils";
import { PersistentSidebar } from "@/components/ui/persistent-sidebar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

import { Edit, AlertCircle, Trash2, X, Save, XCircle, CalendarIcon, Download } from "lucide-react";
import { TimeFormat, DateFormat } from "@/lib/date-utils";
import { InvoicePreview } from "./invoice-preview";
import { generateInvoicePDF } from "@/utils/pdf-generator";

const sportOptions = [
  { id: "football", label: "Football" },
  { id: "basketball", label: "Basketball" },
  { id: "volleyball", label: "Volleyball" },
  { id: "handball", label: "Handball" },
  { id: "hockey", label: "Hockey" },
  { id: "tennis", label: "Tennis" },
];



// Form schema for inline invoice editing - All fields optional for restructuring
const editInvoiceSchema = z.object({
  homeTeam: z.string().optional(),
  awayTeam: z.string().optional(),
  date: z.date().optional(),
  time: z.string().optional(),
  venue: z.string().optional(),
  city: z.string().optional(),
  sport: z.string().optional(),
  category: z.string().optional(),
  team: z.string().optional(),
  teamSizeFormat: z.string().optional(),
  description: z.string().optional(),
});

type EditInvoiceFormData = z.infer<typeof editInvoiceSchema>;

// Function to format date/time in activity descriptions according to user preferences
function formatActivityDescription(description: string, timeFormat: TimeFormat, dateFormat: DateFormat): React.ReactNode {
  // Check if the description contains a date/time update message
  if (description.includes('Date/time updated to')) {
    // Extract the ISO date string
    const dateMatch = description.match(/Date\/time updated to (.*)/);
    if (dateMatch && dateMatch[1]) {
      try {
        const dateStr = dateMatch[1];
        const date = new Date(dateStr);

        // If it's a valid date, format it according to user preference
        if (!isNaN(date.getTime())) {
          const formattedDateTime = formatDateTime(date, timeFormat as TimeFormat, dateFormat);
          return (
            <>
              Date/time updated to <span className="font-medium">{formattedDateTime}</span>
            </>
          );
        }
      } catch (error) {
        // If parsing fails, return the original description
        console.error('Failed to parse date', error);
      }
    }
  }

  // For invoice updates, extract only the change part after the colon
  if (description.includes(': ')) {
    const [_, change] = description.split(': ');
    return change;
  }

  // For all other descriptions, return as is
  return description;
}

export function InvoiceDetailPanel() {
  const { currentInvoice, isInvoicePanelOpen, shouldAnimatePanel, closeInvoicePanel, notifyContact, assignContact, unassignContact, updateContactStatus, openContactPanel, updateInvoice, isInvoiceInEditMode, setInvoiceEditMode } = useApp();
  const { viewMode, currentContactId } = useViewMode();
  const { timeFormat } = useTimeFormat();
  const { dateFormat } = useDateFormat();
  // Contact roles for assignment
  const contactRoles = ["Main Contact", "Assistant Contact", "Coordinator"];
  const { invoiceCategories } = useInvoiceCategories();
  const { teamCategories } = useTeamCategories();
  const { teamSizeFormats } = useTeamSizeFormats();
  const { toast } = useToast();
  const [notes, setNotes] = useState("");
  const [isAssigningContact, setIsAssigningContact] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Function to properly capitalize team categories
  const capitalizeTeamCategory = (category: string | undefined): string => {
    if (!category) return "Not specified";
    // Convert to uppercase for standard team categories like U15, F15, P11, etc.
    return category.toUpperCase();
  };
  // Use app context for edit mode instead of local state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [declineWarningData, setDeclineWarningData] = useState<{
    contactId: number;
    contactName: string;
    declineDate?: string;
  } | null>(null);
  const [isDeclineWarningOpen, setIsDeclineWarningOpen] = useState(false);
  const [alreadyAssignedData, setAlreadyAssignedData] = useState<{
    contactName: string;
  } | null>(null);
  const [isAlreadyAssignedOpen, setIsAlreadyAssignedOpen] = useState(false);
  const [contactsWithDeclines, setContactsWithDeclines] = useState<Set<number>>(new Set());
  const [selectedContactId, setSelectedContactId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>(contactRoles[0] || "Main Contact");
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [isContactDeclineDialogOpen, setIsContactDeclineDialogOpen] = useState(false);
  const [assignmentToDecline, setAssignmentToDecline] = useState<ContactAssignment | null>(null);

  // Form setup for inline editing
  const form = useForm<EditInvoiceFormData>({
    resolver: zodResolver(editInvoiceSchema),
    defaultValues: {
      homeTeam: undefined,
      awayTeam: undefined,
      date: undefined,
      time: undefined,
      venue: undefined,
      city: undefined,
      sport: undefined,
      category: undefined,
      team: undefined,
      teamSizeFormat: undefined,
      description: undefined,
    },
  });

  // Handle inline form submission using app context updateInvoice
  const onSubmit = async (data: EditInvoiceFormData) => {
    if (!currentInvoice) return;
    
    try {
      // Handle optional date and time safely
      let dateTimeString = new Date().toISOString(); // Default fallback
      if (data.date && data.time) {
        const dateObj = new Date(data.date);
        const [hours, minutes] = data.time.split(':');
        dateObj.setHours(parseInt(hours), parseInt(minutes));
        dateTimeString = dateObj.toISOString();
      }
      
      const updateData = {
        homeTeam: data.homeTeam || undefined,
        awayTeam: data.awayTeam || undefined,
        dateTime: dateTimeString,
        venue: data.venue || undefined,
        city: data.city || undefined,
        sport: data.sport || undefined,
        category: data.category || undefined,
        team: data.team || undefined,
        description: embedTeamSizeFormat(data.description || "", data.teamSizeFormat || ""),
      };
      
      await updateInvoice(currentInvoice.id, updateData);
      setIsInlineEditing(false);
      setInvoiceEditMode(false);
    } catch (error) {
      console.error("Error updating invoice:", error);
    }
  };

  // Mutation for deleting an invoice
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      return apiRequest("DELETE", `/api/invoices/${invoiceId}`);
    },
    onSuccess: () => {
      toast({
        title: "Invoice deleted",
        description: "The invoice has been successfully deleted",
      });
      closeInvoicePanel();
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete invoice. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting invoice:", error);
    },
  });

  // Determine if we're in club mode or contact mode
  // We'll use this only for conditional rendering of editing features
  const isClubMode = viewMode === "club";



  // Handle panel close
  const handleClose = () => {
    closeInvoicePanel();
  };

  const { data: assignments, isLoading: isLoadingAssignments } = useQuery<(ContactAssignment & { contact?: Contact })[]>({
    queryKey: currentInvoice ? [`/api/invoices/${currentInvoice.id}/assignments`] : [],
    enabled: !!currentInvoice,
  });

  const { data: contacts } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    enabled: isAssigningContact,
  });

  // Get recent activities for this invoice
  const { data: activities } = useQuery<Activity[]>({
    queryKey: ['/api/activities'],
    enabled: !!currentInvoice,
  });

  useEffect(() => {
    if (currentInvoice) {
      setNotes(currentInvoice.description || "");
      
      // Initialize form when invoice changes or editing starts
      if (currentInvoice) {
        const invoiceDate = new Date(currentInvoice.dateTime);
        form.reset({
          homeTeam: currentInvoice.homeTeam,
          awayTeam: currentInvoice.awayTeam,
          date: invoiceDate, // Use Date object
          time: invoiceDate.toTimeString().slice(0, 5), // HH:MM format
          venue: currentInvoice.venue,
          city: currentInvoice.city || "",
          sport: currentInvoice.sport,
          category: currentInvoice.category || "",
          team: currentInvoice.team || "",
          teamSizeFormat: extractTeamSizeFormat(currentInvoice.description),
          description: getCleanDescription(currentInvoice.description) || "",
        });
      }
    }
  }, [currentInvoice, form]);

  // Check decline history for all contacts when invoice or contacts change
  useEffect(() => {
    const checkAllContactsDeclineHistory = async () => {
      if (!currentInvoice || !contacts) return;

      const contactsWithDeclines = new Set<number>();

      for (const contact of contacts) {
        try {
          const response = await fetch(`/api/invoices/${currentInvoice.id}/contact/${contact.id}/decline-history`);
          if (response.ok) {
            const declineData = await response.json();
            if (declineData.hasDeclined) {
              contactsWithDeclines.add(contact.id);
            }
          }
        } catch (error) {
          console.warn(`Failed to check decline history for contact ${contact.id}:`, error);
        }
      }

      setContactsWithDeclines(contactsWithDeclines);
    };

    checkAllContactsDeclineHistory();
  }, [currentInvoice, contacts]);

  // Editing functions using app context
  const startEditing = () => {
    setIsInlineEditing(true);
    setInvoiceEditMode(true);
    
    // Initialize form with current invoice data when starting to edit
    if (currentInvoice) {
      const invoiceDate = new Date(currentInvoice.dateTime);
      form.reset({
        homeTeam: currentInvoice.homeTeam,
        awayTeam: currentInvoice.awayTeam,
        date: invoiceDate,
        time: invoiceDate.toTimeString().slice(0, 5),
        venue: currentInvoice.venue,
        city: currentInvoice.city || "",
        sport: currentInvoice.sport,
        category: currentInvoice.category || "",
        team: currentInvoice.team || "",
        teamSizeFormat: extractTeamSizeFormat(currentInvoice.description),
        description: getCleanDescription(currentInvoice.description || ""),
      });
    }
  };

  const cancelEditing = () => {
    setIsInlineEditing(false);
    setInvoiceEditMode(false);
    if (currentInvoice) {
      // Reset form to original values
      const invoiceDate = new Date(currentInvoice.dateTime);
      form.reset({
        homeTeam: currentInvoice.homeTeam,
        awayTeam: currentInvoice.awayTeam,
        date: invoiceDate,
        time: invoiceDate.toTimeString().slice(0, 5),
        venue: currentInvoice.venue,
        city: currentInvoice.city || "",
        sport: currentInvoice.sport,
        category: currentInvoice.category || "",
        team: currentInvoice.team || "",
        teamSizeFormat: extractTeamSizeFormat(currentInvoice.description),
        description: getCleanDescription(currentInvoice.description || ""),
      });
    }
  };



  if (!isInvoicePanelOpen || !currentInvoice) {
    return null;
  }

  const invoiceDate = new Date(currentInvoice.dateTime);
  const isInvoiceInPast = invoiceDate < new Date();

  // Map display role names to enum constants
  const mapRoleToEnum = (role: string): string => {
    switch (role) {
      case "Main Referee":
        return "MAIN_CONTACT";
      case "Linesman":
      case "Assistant Referee":
        return "LINESMAN";
      case "Fourth Official":
        return "FOURTH_OFFICIAL";
      default:
        return "MAIN_CONTACT"; // fallback
    }
  };

  const handleAssignContact = async () => {
    if (selectedContactId && currentInvoice) {
      try {
        // Check if contact has previously declined this invoice
        const response = await fetch(`/api/invoices/${currentInvoice.id}/contact/${selectedContactId}/decline-history`);
        if (response.ok) {
          const declineData = await response.json();
          if (declineData.hasDeclined) {
            // Find contact name
            const selectedContact = contacts?.find(r => r.id === parseInt(selectedContactId));
            setDeclineWarningData({
              contactId: parseInt(selectedContactId),
              contactName: selectedContact?.fullName || "Unknown Contact",
              declineDate: declineData.declineDate
            });
            setIsDeclineWarningOpen(true);
            return; // Don't proceed with assignment, wait for user confirmation
          }
        }

        // Map the selected role to the enum constant
        const roleEnum = mapRoleToEnum(selectedRole);
        
        // If no decline history or check failed, proceed with assignment
        await assignContact(currentInvoice.id, parseInt(selectedContactId), roleEnum);
        setIsAssigningContact(false);
        setSelectedContactId("");
      } catch (error: unknown) {
        // Check if the error is because contact is already assigned
        if (error?.message?.includes("already assigned") || error?.response?.data?.message?.includes("already assigned")) {
          const selectedContact = contacts?.find(r => r.id === parseInt(selectedContactId));
          setAlreadyAssignedData({
            contactName: selectedContact?.fullName || "Unknown Contact"
          });
          setIsAlreadyAssignedOpen(true);
          return;
        }
        
        console.warn("Failed to check decline history, proceeding with assignment:", error);
        try {
          // Map the selected role to the enum constant
          const roleEnum = mapRoleToEnum(selectedRole);
          await assignContact(currentInvoice.id, parseInt(selectedContactId), roleEnum);
          setIsAssigningContact(false);
          setSelectedContactId("");
        } catch (assignError: unknown) {
          // Check again for already assigned error in the assignment attempt
          if (assignError?.message?.includes("already assigned") || assignError?.response?.data?.message?.includes("already assigned")) {
            const selectedContact = contacts?.find(r => r.id === parseInt(selectedContactId));
            setAlreadyAssignedData({
              contactName: selectedContact?.fullName || "Unknown Contact"
            });
            setIsAlreadyAssignedOpen(true);
          }
        }
      }
    }
  };

  const handleConfirmAssignDeclinedReferee = async () => {
    if (declineWarningData && currentInvoice) {
      try {
        await assignContact(currentInvoice.id, declineWarningData.contactId, selectedRole);
        setIsAssigningContact(false);
        setSelectedContactId("");
        setIsDeclineWarningOpen(false);
        setDeclineWarningData(null);
      } catch (error) {
        console.error("Failed to assign referee:", error);
      }
    }
  };

  const handleCancelDeclineWarning = () => {
    setIsDeclineWarningOpen(false);
    setDeclineWarningData(null);
  };

  const handleCloseAlreadyAssigned = () => {
    setIsAlreadyAssignedOpen(false);
    setAlreadyAssignedData(null);
  };

  const handleContactDecline = (assignment: ContactAssignment) => {
    setAssignmentToDecline(assignment);
    setIsContactDeclineDialogOpen(true);
  };

  const handleConfirmRefereeDecline = async () => {
    if (!assignmentToDecline || !currentContactId) return;

    try {
      const response = await fetch(`/api/assignments/${assignmentToDecline.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          response: "DECLINED", 
          refereeId: currentContactId
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        throw new Error(errorData.message || "Failed to decline assignment");
      }

      // Invalidate queries to refresh the data
      await queryClient.invalidateQueries({ queryKey: [`/api/invoices/${currentInvoice?.id}/assignments`] });
      await queryClient.invalidateQueries({ queryKey: [`/api/contacts/${currentContactId}/assignments`] });

      toast({
        title: "Assignment Declined",
        description: "You have successfully declined this assignment",
      });

      setIsContactDeclineDialogOpen(false);
      setAssignmentToDecline(null);
    } catch (error) {
      console.error("Error declining assignment:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to decline assignment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCancelContactDecline = () => {
    setIsContactDeclineDialogOpen(false);
    setAssignmentToDecline(null);
  };

  // PDF generation handler
  const handleDownloadPDF = async () => {
    if (!currentInvoice) return;
    
    setIsGeneratingPDF(true);
    try {
      await generateInvoicePDF(
        `invoice-preview-${currentInvoice.id}`,
        {
          ...currentInvoice,
          city: currentInvoice.city || null,
          team: currentInvoice.team || null,
          dateTime: new Date(currentInvoice.dateTime),
          createdAt: currentInvoice.createdAt ? new Date(currentInvoice.createdAt) : null
        }
      );
      
      toast({
        title: "PDF Generated",
        description: "Invoice PDF has been downloaded successfully",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };



  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 pt-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-neutral-900">{currentInvoice.homeTeam} vs {currentInvoice.awayTeam}</h2>
            <div className="flex items-center gap-2">
              {viewMode === "club" && !isInlineEditing ? (
                <>
                  <Button
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPDF}
                    variant="subtleGray"
                    className="px-3 py-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isGeneratingPDF ? "Generating..." : "Download PDF"}</span>
                  </Button>
                  <Button onClick={startEditing} variant="subtleBlue" className="px-3 py-2 text-sm">
                    <Edit className="w-4 h-4" />
                    <span>Edit</span>
                  </Button>
                </>
              ) : viewMode === "club" ? (
                <div className="flex items-center gap-2">
                  <Button
                    onClick={form.handleSubmit(onSubmit)}
                    variant="filledGreen"
                    className="px-3 py-2 text-sm"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save</span>
                  </Button>
                  <Button
                    onClick={cancelEditing}
                    variant="subtleRed"
                    className="px-3 py-2 text-sm"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Cancel</span>
                  </Button>
                </div>
              ) : null}
              {!isInlineEditing && (
                <Button
                  variant="subtleRed"
                  onClick={closeInvoicePanel}
                  className="px-3 py-2 text-sm"
                >
                  <X className="w-4 h-4" />
                  <span>Close</span>
                </Button>
              )}
            </div>
          </div>
          <div className="mb-6">
            {!isInlineEditing ? (
              /* View Mode - Invoice details grid */
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <p className="text-neutral-600 text-xs font-medium">Date</p>
                    <p className="text-sm font-semibold text-neutral-800">{format(invoiceDate, "EEE dd MMM yyyy")}</p>
                  </div>
                  <div>
                    <p className="text-neutral-600 text-xs font-medium">Time</p>
                    <p className="text-sm font-semibold text-neutral-800">{format(invoiceDate, "HH:mm")}</p>
                  </div>
                  <div>
                    <p className="text-neutral-600 text-xs font-medium">Venue</p>
                    <p className="text-sm font-semibold text-neutral-800">{currentInvoice.venue}</p>
                  </div>
                  <div>
                    <p className="text-neutral-600 text-xs font-medium">City</p>
                    <p className="text-sm font-semibold text-neutral-800">{currentInvoice.city || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-neutral-600 text-xs font-medium">Category</p>
                    <p className="text-sm font-semibold text-neutral-800">{currentInvoice.category}</p>
                  </div>
                  <div>
                    <p className="text-neutral-600 text-xs font-medium">Sport</p>
                    <p className="text-sm font-semibold text-neutral-800">{currentInvoice.sport}</p>
                  </div>
                  <div>
                    <p className="text-neutral-600 text-xs font-medium">Team Category</p>
                    <p className="text-sm font-semibold text-neutral-800">{capitalizeTeamCategory(currentInvoice.team || "")}</p>
                  </div>
                  <div>
                    <p className="text-neutral-600 text-xs font-medium">Team Size Format</p>
                    <p className="text-sm font-semibold text-neutral-800">
                      {(() => {
                        const extracted = extractTeamSizeFormat(currentInvoice.description);
                        const label = getTeamSizeFormatLabel(extracted);
                        console.log('Team Size Debug:', { 
                          description: currentInvoice.description, 
                          extracted, 
                          label,
                          invoiceId: currentInvoice.id 
                        });
                        return label;
                      })()}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-neutral-500">Information</p>
                  <p className="text-sm">{getCleanDescription(currentInvoice.description) || "No description available."}</p>
                </div>
                
                {/* Thin line separator */}
                <div className="border-t border-neutral-200"></div>
              </>
            ) : (
              /* Edit Mode - Form fields */
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="homeTeam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Home Team</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Home Team" 
                              className="form-field-subtle touch-manipulation"
                              style={{ fontSize: '16px', minHeight: '44px', padding: '10px 14px' }}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="awayTeam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Away Team</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Away Team" 
                              className="form-field-subtle touch-manipulation"
                              style={{ fontSize: '16px', minHeight: '44px', padding: '10px 14px' }}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Date</FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant={"outline"}
                                  className={cn(
                                    "form-field-subtle w-full pl-3 text-left font-normal touch-manipulation",
                                    !field.value && "text-muted-foreground"
                                  )}
                                  style={{ minHeight: '44px', fontSize: '16px' }}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>Select date</span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={field.value instanceof Date ? field.value : undefined}
                                onSelect={field.onChange}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="time"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Invoice Time</FormLabel>
                          <FormControl>
                            <Input 
                              type="time" 
                              className="touch-manipulation"
                              style={{ fontSize: '16px', minHeight: '44px', padding: '10px 14px' }}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="venue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Venue</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Invoice venue" 
                              className="form-field-subtle touch-manipulation"
                              style={{ fontSize: '16px', minHeight: '44px', padding: '10px 14px' }}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>City</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="City" 
                              className="touch-manipulation"
                              style={{ fontSize: '16px', minHeight: '44px', padding: '10px 14px' }}
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="touch-manipulation" style={{ minHeight: '44px', fontSize: '16px' }}>
                                <SelectValue placeholder="Select a category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {invoiceCategories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="sport"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sport</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="touch-manipulation" style={{ minHeight: '44px', fontSize: '16px' }}>
                                <SelectValue placeholder="Select a sport" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {sportOptions.map((sport) => (
                                <SelectItem key={sport.id} value={sport.id}>
                                  {sport.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="team"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Category</FormLabel>
                          <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="touch-manipulation" style={{ minHeight: '44px', fontSize: '16px' }}>
                                <SelectValue placeholder="Select a team" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {teamCategories.map((category) => (
                                <SelectItem key={category.toLowerCase()} value={category.toLowerCase()}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="teamSizeFormat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Team Size Format</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="touch-manipulation" style={{ minHeight: '44px', fontSize: '16px' }}>
                                <SelectValue placeholder="Select team size format" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {teamSizeFormats.map((format) => (
                                <SelectItem key={format} value={format}>
                                  {format}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description (Optional)</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Additional invoice details"
                              className="resize-none min-h-[100px]"
                              {...field}
                              value={field.value || ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Add any additional information about the invoice
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </form>
              </Form>
            )}
          </div>

          {!isInlineEditing && (
            <div className="mt-8 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Assigned Contacts</h4>
                {isClubMode && !isInvoiceInPast && (
                <Dialog open={isAssigningContact} onOpenChange={setIsAssigningContact}>
                  <DialogTrigger asChild>
                    <Button
                      variant="filledGreen"
                      className="px-6 py-3 h-auto text-sm shadow-lg hover:shadow-xl"
                      style={{ borderRadius: '6px' }}
                    >
                      <span className="material-icons text-base mr-2">add</span>
                      Assign Contact
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Assign Contact</DialogTitle>
                      <DialogDescription>
                        Select a contact and role for this invoice.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Contact</label>
                        <Select
                          value={selectedContactId}
                          onValueChange={setSelectedContactId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select contact" />
                          </SelectTrigger>
                          <SelectContent>
                            {contacts?.map((contact) => (
                              <SelectItem 
                                key={contact.id} 
                                value={contact.id.toString()}
                              >
                                <div className="flex items-center gap-2">
                                  {contactsWithDeclines.has(contact.id) && (
                                    <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Previously declined this invoice" />
                                  )}
                                  <span>{contact.fullName} - {contact.qualificationLevel}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Role</label>
                        <Select
                          value={selectedRole}
                          onValueChange={setSelectedRole}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {contactRoles.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="subtleRed"
                        className="px-3 py-2 text-sm"
                        onClick={() => setIsAssigningContact(false)}
                      >
                        <span>Cancel</span>
                      </Button>
                      <Button
                        variant="filledGreen"
                        className="px-6 py-3 h-auto text-sm shadow-lg hover:shadow-xl"
                        style={{ borderRadius: '6px', minHeight: '44px' }}
                        onClick={handleAssignContact}
                        disabled={!selectedContactId}
                      >
                        <span>Assign Contact</span>
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {isLoadingAssignments ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
              </div>
            ) : !assignments || assignments.length === 0 ? (
              <div className="text-center py-4 text-neutral-500">
                No referees assigned yet
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {assignments.map((assignment) => {
                  // Get border color based on status
                  const getStatusBorderColor = (status: ContactStatus) => {
                    switch (status) {
                      case ContactStatus.ASSIGNED:
                        return 'border-green-500';
                      case ContactStatus.NOTIFIED:
                        return 'border-orange-500';
                      case ContactStatus.DECLINED:
                        return 'border-red-500';
                      case ContactStatus.NOT_NOTIFIED:
                        return 'border-neutral-400';
                      default:
                        return 'border-neutral-200';
                    }
                  };

                  return (
                    <div key={assignment.id} className={`p-3 bg-white rounded-md border ${getStatusBorderColor(assignment.status as ContactStatus)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center cursor-pointer hover:bg-primary-100 hover:border-primary-300 border transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (assignment.contact) {
                                  const contact = assignment.contact;
                                  // Close invoice panel first, then open contact panel
                                  closeInvoicePanel();
                                  // Small timeout to ensure smooth transition
                                  setTimeout(() => {
                                    openContactPanel(contact);
                                  }, 50);
                                }
                              }}
                              title="View contact details"
                            >
                              <span className="material-icons text-sm text-neutral-500">person</span>
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center justify-between">
                                <h5 
                                  className="font-medium cursor-pointer hover:text-primary-600 transition-colors flex items-center gap-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (assignment.contact) {
                                      const contact = assignment.contact;
                                      // Close invoice panel first, then open contact panel
                                      closeInvoicePanel();
                                      // Small timeout to ensure smooth transition
                                      setTimeout(() => {
                                        openContactPanel(contact);
                                      }, 50);
                                    }
                                  }}
                                >
                                  {assignment.contact?.fullName || "Contact"}
                                  <span className="material-icons text-xs text-neutral-400 opacity-60">info</span>
                                </h5>
                                <span className="text-xs text-neutral-600 ml-2">
                                  {assignment.role || "Contact"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <StatusBadge status={assignment.status as ContactStatus} size="sm" />
                            {/* Show decline button for current contact's own assignment */}
                            {!isClubMode && currentContactId && assignment.contactId === currentContactId && assignment.status === ContactStatus.ASSIGNED && (
                              <button
                                className="flex items-center space-x-1 px-2 py-1 text-xs font-medium transition-all cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 hover:border-red-300 rounded"
                                onClick={() => handleContactDecline(assignment)}
                              >
                                <span className="material-icons text-xs">cancel</span>
                                <span>Decline</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons - Only show for other contacts */}
                        {assignment.contactId !== currentContactId && (
                          <div className="flex justify-between gap-2 mt-3">
                            <div className="flex gap-2">
                              <button className="flex items-center space-x-1 px-3 py-2 text-xs font-medium transition-all cursor-pointer text-blue-600 hover:text-blue-700 hover:bg-blue-50 opacity-60 hover:opacity-100">
                                <span className="material-icons text-xs">phone</span>
                                <span>Call</span>
                              </button>
                              {isClubMode && assignment.status === ContactStatus.NOT_NOTIFIED ? (
                                <button
                                  className="flex items-center space-x-1 px-3 py-2 text-xs font-medium transition-all cursor-pointer text-green-600 hover:text-green-700 hover:bg-green-50 opacity-60 hover:opacity-100"
                                  onClick={() => notifyContact(assignment.id)}
                                >
                                  <span className="material-icons text-xs">mail</span>
                                  <span>Notify</span>
                                </button>
                              ) : (
                                <button className="flex items-center space-x-1 px-3 py-2 text-xs font-medium transition-all cursor-pointer text-blue-600 hover:text-blue-700 hover:bg-blue-50 opacity-60 hover:opacity-100">
                                  <span className="material-icons text-xs">mail</span>
                                  <span>Message</span>
                                </button>
                              )}
                            </div>

                            {isClubMode && (
                              <div className="flex gap-2">
                                <Select 
                                  onValueChange={(value) => updateContactStatus(assignment.id, value)}
                                  defaultValue={assignment.status}
                                >
                                  <SelectTrigger className="h-auto w-auto text-xs border-0 bg-transparent p-0 font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-all [&>svg]:hidden opacity-60 hover:opacity-100">
                                    <div className="flex items-center space-x-1 px-3 py-2">
                                      <span className="material-icons text-xs">edit</span>
                                      <span>Edit</span>
                                    </div>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={ContactStatus.NOT_NOTIFIED}>Not Notified</SelectItem>
                                    <SelectItem value={ContactStatus.NOTIFIED}>Notified</SelectItem>
                                    <SelectItem value={ContactStatus.ASSIGNED}>Assigned</SelectItem>
                                    <SelectItem value={ContactStatus.DECLINED}>Declined</SelectItem>
                                  </SelectContent>
                                </Select>
                                <button 
                                  className="flex items-center space-x-1 px-3 py-2 text-xs font-medium transition-all cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50 opacity-60 hover:opacity-100"
                                  onClick={() => unassignContact(assignment.id)}
                                >
                                  <span className="material-icons text-xs">remove_circle</span>
                                  <span>Remove</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          )}



          {/* Latest Changes section */}
          {isClubMode && activities && activities.length > 0 && (
            <div className="mt-6 border-t border-neutral-200 pt-4">
              <h4 className="font-medium mb-3 flex items-center">
                <AlertCircle className="w-4 h-4 mr-2 text-green-500" />
                Latest Changes
              </h4>
              <div className="space-y-2">
                {activities
                  .filter(activity => 
                    activity.invoiceId === currentInvoice.id && 
                    [
                      // Invoice changes
                      ActivityType.INVOICE_UPDATED, 
                      ActivityType.INVOICE_CREATED,
                      // Referee assignment changes
                      ActivityType.ASSIGNMENT_CREATED,
                      ActivityType.ASSIGNMENT_UPDATED,
                      ActivityType.ASSIGNMENT_DELETED,
                      ActivityType.ASSIGNMENT_ACCEPTED,
                      ActivityType.ASSIGNMENT_DECLINED,
                      ActivityType.NOTIFICATION_SENT
                    ].includes(activity.activityType))
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) // Sort latest first
                  .slice(0, 5) // Show more activities
                  .map(activity => (
                    <div key={activity.id} className="text-xs text-neutral-600">
                      <p>{activity.description}</p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {formatDistance(new Date(activity.createdAt), new Date(), { addSuffix: true })} • {formatTime(activity.createdAt, timeFormat)}
                      </p>
                    </div>
                  ))}
                {activities.filter(activity => 
                  activity.invoiceId === currentInvoice.id &&
                  [
                    ActivityType.INVOICE_UPDATED,
                    ActivityType.INVOICE_CREATED,
                    ActivityType.ASSIGNMENT_CREATED,
                    ActivityType.ASSIGNMENT_ACCEPTED,
                    ActivityType.ASSIGNMENT_DECLINED,
                    ActivityType.ASSIGNMENT_DELETED,
                    ActivityType.NOTIFICATION_SENT
                  ].includes(activity.activityType)).length === 0 && (
                  <div className="text-sm text-neutral-500 italic">
                    No recent changes to display
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Delete button at the bottom - hide when in edit mode */}
          {isClubMode && !isInlineEditing && (
            <div className="mt-6 pt-4 border-t border-neutral-200">
              {/* Invoice creation info */}
              {currentInvoice.createdAt && (
                <div className="mb-4">
                  <p className="text-xs text-neutral-500 italic">
                    Created on {format(new Date(currentInvoice.createdAt), "dd MMM yyyy")}
                  </p>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button 
                  onClick={() => setIsDeleteDialogOpen(true)} 
                  variant="ghost" 
                  size="sm"
                  className="flex items-center text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Invoice
                </Button>
              </div>
            </div>
          )}



          {/* Delete Invoice Confirmation Dialog */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete this invoice?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the invoice
                  and all associated referee assignments.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    if (currentInvoice) {
                      deleteInvoiceMutation.mutate(currentInvoice.id);
                    }
                    setIsDeleteDialogOpen(false);
                  }}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteInvoiceMutation.isPending ? "Deleting..." : "Delete Invoice"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Decline Warning Dialog */}
          <AlertDialog open={isDeclineWarningOpen} onOpenChange={setIsDeclineWarningOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Referee Previously Declined
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {declineWarningData && (
                    <>
                      <strong>{declineWarningData.contactName}</strong> has previously declined this invoice
                      {declineWarningData.declineDate && (
                        <span> on {format(new Date(declineWarningData.declineDate), 'PPp')}</span>
                      )}.
                      <br /><br />
                      Are you sure you want to assign them again?
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel 
                  onClick={handleCancelDeclineWarning}
                  className="bg-white text-blue-600 border-0 hover:bg-blue-50"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleConfirmAssignDeclinedReferee}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Assign Anyway
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Already Assigned Warning Dialog */}
          <AlertDialog open={isAlreadyAssignedOpen} onOpenChange={setIsAlreadyAssignedOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  Referee Already Assigned
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {alreadyAssignedData && (
                    <>
                      <strong>{alreadyAssignedData.contactName}</strong> is already assigned to this invoice.
                      <br /><br />
                      Each referee can only be assigned once per invoice.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel 
                  onClick={handleCloseAlreadyAssigned}
                  className="bg-white text-blue-600 border-0 hover:bg-blue-50"
                >
                  OK
                </AlertDialogCancel>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Referee Decline Dialog */}
          <AlertDialog open={isContactDeclineDialogOpen} onOpenChange={setIsContactDeclineDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Decline Assignment</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to decline this invoice? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel 
                  onClick={() => setIsContactDeclineDialogOpen(false)}
                  className="bg-white text-blue-600 border-0 hover:bg-blue-50"
                >
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    if (assignmentToDecline) {
                      // Handle decline logic here
                      setIsContactDeclineDialogOpen(false);
                      setAssignmentToDecline(null);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Confirm Decline
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Hidden PDF Preview Component for PDF Generation */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div id={`invoice-preview-${currentInvoice.id}`}>
          <InvoicePreview invoice={{
            ...currentInvoice, 
            city: currentInvoice.city || null, 
            team: currentInvoice.team || null,
            dateTime: new Date(currentInvoice.dateTime),
            createdAt: currentInvoice.createdAt ? new Date(currentInvoice.createdAt) : null
          }} />
        </div>
      </div>
    </div>
  );
}