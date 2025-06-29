import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { CalendarIcon, X, Plus, Trash2, Save } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

// Form schema for invoice creation - All fields made optional for restructuring
const invoiceItemSchema = z.object({
  description: z.string().optional(),
  quantity: z.number().optional(),
  unitPrice: z.number().optional(),
  discount: z.number().optional(),
  taxRate: z.number().optional(),
});

const invoiceFormSchema = z.object({
  // General Invoice Details
  invoiceNumber: z.string().optional(),
  invoiceDate: z.date().optional(),
  dueDate: z.date().optional(),
  currency: z.string().optional(),
  paymentTerms: z.string().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),

  // Seller Information
  sellerCompanyName: z.string().optional(),
  sellerOrgNumber: z.string().optional(),
  sellerVatNumber: z.string().optional(),
  sellerStreet: z.string().optional(),
  sellerPostalCode: z.string().optional(),
  sellerCity: z.string().optional(),
  sellerCountry: z.string().optional(),
  sellerPhone: z.string().optional(),
  sellerEmail: z.string().optional(),
  sellerWebsite: z.string().optional(),
  sellerBankDetails: z.string().optional(),

  // Buyer Information
  buyerCompanyName: z.string().optional(),
  buyerVatNumber: z.string().optional(),
  buyerStreet: z.string().optional(),
  buyerPostalCode: z.string().optional(),
  buyerCity: z.string().optional(),
  buyerCountry: z.string().optional(),
  buyerContactPerson: z.string().optional(),
  buyerEmail: z.string().optional(),

  // Itemized List
  items: z.array(invoiceItemSchema).optional(),

  // Payment Information
  bankAccountDetails: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentReference: z.string().optional(),
  latePaymentTerms: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

interface InvoiceCreatePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const currencyOptions = [
  "SEK", "EUR", "USD", "GBP", "NOK", "DKK"
];

const paymentTermsOptions = [
  "Net 30", "Net 15", "Net 10", "Due on receipt", "Net 60"
];

const paymentMethodOptions = [
  "Bank Transfer", "Card Payment", "Invoice", "Direct Debit", "Cash"
];

export function InvoiceCreatePanel({ isOpen, onClose }: InvoiceCreatePanelProps) {
  const { toast } = useToast();

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: {
      invoiceNumber: "",
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      currency: "SEK",
      paymentTerms: "Net 30",
      reference: "",
      notes: "",
      
      // Seller Information
      sellerCompanyName: "",
      sellerOrgNumber: "",
      sellerVatNumber: "",
      sellerStreet: "",
      sellerPostalCode: "",
      sellerCity: "",
      sellerCountry: "Sweden",
      sellerPhone: "",
      sellerEmail: "",
      sellerWebsite: "",
      sellerBankDetails: "",
      
      // Buyer Information
      buyerCompanyName: "",
      buyerVatNumber: "",
      buyerStreet: "",
      buyerPostalCode: "",
      buyerCity: "",
      buyerCountry: "",
      buyerContactPerson: "",
      buyerEmail: "",
      
      // Items
      items: [{
        description: "",
        quantity: 1,
        unitPrice: 0,
        discount: 0,
        taxRate: 25
      }],
      
      // Payment Information
      bankAccountDetails: "",
      paymentMethod: "Bank Transfer",
      paymentReference: "",
      latePaymentTerms: ""
    },
  });

  const {
    fields: itemFields,
    append: appendItem,
    remove: removeItem,
  } = useFieldArray({
    control: form.control,
    name: "items",
  });

  // Calculate totals
  const watchedItems = form.watch("items");
  const subtotal = watchedItems?.reduce((sum, item) => {
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
    const discountAmount = lineTotal * ((item.discount || 0) / 100);
    return sum + (lineTotal - discountAmount);
  }, 0) || 0;

  const vatAmount = watchedItems?.reduce((sum, item) => {
    const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
    const discountAmount = lineTotal * ((item.discount || 0) / 100);
    const taxableAmount = lineTotal - discountAmount;
    return sum + (taxableAmount * ((item.taxRate || 0) / 100));
  }, 0) || 0;

  const totalAmount = subtotal + vatAmount;

  // Create invoice mutation
  const createInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormValues) => {
      return apiRequest("POST", "/api/invoices", {
        // Map the comprehensive invoice data to your existing API structure
        homeTeam: data.buyerCompanyName || "Buyer",
        awayTeam: data.sellerCompanyName || "Seller",
        dateTime: data.invoiceDate ? data.invoiceDate.toISOString() : new Date().toISOString(),
        venue: `Invoice #${data.invoiceNumber || "Draft"}`,
        city: data.buyerCity || "",
        category: "Invoice",
        team: "",
        description: `${data.notes || ""}\n\nItems: ${data.items ? data.items.map(item => 
          `${item.description || "Item"} (${item.quantity || 1}x ${item.unitPrice || 0} ${data.currency || "USD"})`
        ).join(", ") : "No items"}\n\nTotal: ${totalAmount.toFixed(2)} ${data.currency || "USD"}`,
        status: "UPCOMING",
        sport: "business",
      });
    },
    onSuccess: () => {
      toast({
        title: "Invoice created",
        description: "The invoice has been successfully created",
      });
      form.reset();
      onClose();
      queryClient.invalidateQueries({ queryKey: ['/api/invoices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create invoice. Please try again.",
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: InvoiceFormValues) {
    createInvoiceMutation.mutate(data);
  }

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 pt-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Create New Invoice</h2>
              <p className="text-sm text-neutral-500">Enter comprehensive invoice details below</p>
            </div>
            <Button onClick={onClose} variant="subtleRed" className="px-3 py-2 text-sm">
              <X className="w-4 h-4" />
              <span>Close</span>
            </Button>
          </div>
          
          <div className="space-y-6 max-h-[80vh] overflow-y-auto px-1">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* General Invoice Details */}
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">General Invoice Details</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="invoiceNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Invoice Number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select currency" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {currencyOptions.map((currency) => (
                                  <SelectItem key={currency} value={currency}>
                                    {currency}
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
                        name="invoiceDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Invoice Date</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
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
                                  selected={field.value}
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
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Due Date </FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
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
                                  selected={field.value}
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
                        name="paymentTerms"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Terms </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select payment terms" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {paymentTermsOptions.map((term) => (
                                  <SelectItem key={term} value={term}>
                                    {term}
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
                        name="reference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Reference</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="PO number or contact person" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Additional information" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <hr className="border-neutral-200" />

                {/* Seller Information */}
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Seller Information</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="sellerCompanyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="sellerEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address </FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="sellerOrgNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Organization Number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="sellerVatNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VAT Number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="sellerStreet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Address </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="sellerPostalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="sellerCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="sellerCountry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="sellerPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="sellerWebsite"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="sellerBankDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Details</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Bankgiro / IBAN / SWIFT / BIC" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
                
                <hr className="border-neutral-200" />

                {/* Buyer Information */}
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Buyer Information</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="buyerCompanyName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Company Name </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="buyerEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Email Address </FormLabel>
                            <FormControl>
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="buyerVatNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>VAT Number</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="buyerContactPerson"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contact Person</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="buyerStreet"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Street Address </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="buyerPostalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Postal Code </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="buyerCity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>City </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="buyerCountry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country </FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
                
                <hr className="border-neutral-200" />

                {/* Itemized List */}
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Itemized List</h3>
                  <div className="space-y-4">
                    {itemFields.map((field, index) => (
                      <div key={field.id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium">Item {index + 1}</h4>
                          {itemFields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          <div className="md:col-span-2 lg:col-span-1">
                            <FormField
                              control={form.control}
                              name={`items.${index}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description </FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          <FormField
                            control={form.control}
                            name={`items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Quantity </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`items.${index}.unitPrice`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Unit Price </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`items.${index}.discount`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Discount (%)</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    max="100"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={form.control}
                            name={`items.${index}.taxRate`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tax Rate (%) </FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    max="100"
                                    {...field}
                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <div className="flex items-end">
                            <div className="text-sm">
                              <span className="text-neutral-500">Line Total: </span>
                              <span className="font-medium">
                                {(() => {
                                  const item = watchedItems?.[index];
                                  if (!item) return "0.00";
                                  const lineTotal = (item.quantity || 0) * (item.unitPrice || 0);
                                  const discountAmount = lineTotal * ((item.discount || 0) / 100);
                                  const taxableAmount = lineTotal - discountAmount;
                                  const taxAmount = taxableAmount * ((item.taxRate || 0) / 100);
                                  return (taxableAmount + taxAmount).toFixed(2);
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => appendItem({
                        description: "",
                        quantity: 1,
                        unitPrice: 0,
                        discount: 0,
                        taxRate: 25
                      })}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                </div>
                
                <hr className="border-neutral-200" />

                {/* Totals */}
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Totals</h3>
                  <div className="bg-neutral-50 p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal (excluding VAT):</span>
                      <span className="font-medium">{subtotal.toFixed(2)} {form.watch("currency")}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT amount:</span>
                      <span className="font-medium">{vatAmount.toFixed(2)} {form.watch("currency")}</span>
                    </div>
                    <hr className="border-neutral-200" />
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total amount (including VAT):</span>
                      <span>{totalAmount.toFixed(2)} {form.watch("currency")}</span>
                    </div>
                  </div>
                </div>
                
                <hr className="border-neutral-200" />

                {/* Payment Information */}
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900 mb-4">Payment Information</h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="paymentMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Method </FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select payment method" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {paymentMethodOptions.map((method) => (
                                  <SelectItem key={method} value={method}>
                                    {method}
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
                        name="paymentReference"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Payment Reference</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="e.g. invoice number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="bankAccountDetails"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bank Account Details</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Bank account information for payments" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="latePaymentTerms"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Late Payment Terms</FormLabel>
                          <FormControl>
                            <Textarea {...field} placeholder="Interest or fees for late payments" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-6">
                  <Button type="button" variant="filledGreen">
                    <Save className="w-4 h-4 mr-2" />
                    Save Draft
                  </Button>
                  <Button type="submit" variant="subtleBlue" disabled={createInvoiceMutation.isPending}>
                    <Plus className="w-4 h-4 mr-2" />
                    {createInvoiceMutation.isPending ? "Creating..." : "Create Invoice"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}