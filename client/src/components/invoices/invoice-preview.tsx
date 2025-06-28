import React from "react";
import { Invoice } from "@shared/schema";
import { format } from "date-fns";
import { Building2 } from "lucide-react";
import { useTimeFormat } from "@/context/time-format-context";
import { useDateFormat } from "@/context/date-format-context";
import { DateFormat } from "@/lib/date-utils";

interface InvoicePreviewProps {
  invoice: Invoice;
  className?: string;
}

export function InvoicePreview({ invoice, className = "" }: InvoicePreviewProps) {
  const { timeFormat } = useTimeFormat();
  const { dateFormat } = useDateFormat();
  
  const invoiceDate = new Date(invoice.dateTime);
  
  return (
    <div className={`bg-white p-8 ${className}`} style={{ minHeight: "297mm", width: "210mm" }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Building2 className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-neutral-900">The Company 25</h1>
            <p className="text-xs text-neutral-600">Professional Services Invoice</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-base font-semibold text-neutral-900">INVOICE</h2>
          <p className="text-xs text-neutral-600">#{invoice.id.toString().padStart(6, '0')}</p>
          <p className="text-xs text-neutral-600">
            {format(new Date(), dateFormat === DateFormat.EUROPEAN ? 'dd/MM/yyyy' : 'MM/dd/yyyy')}
          </p>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="text-xs font-semibold text-neutral-900 mb-2">Service Details</h3>
          <div className="space-y-1">
            <div>
              <span className="text-xs text-neutral-600">Event:</span>
              <p className="text-sm font-semibold">{invoice.homeTeam} vs {invoice.awayTeam}</p>
            </div>
            <div>
              <span className="text-xs text-neutral-600">Date & Time:</span>
              <p className="text-sm font-semibold">
                {format(invoiceDate, dateFormat === DateFormat.EUROPEAN ? 'dd/MM/yyyy' : 'MM/dd/yyyy')} at {format(invoiceDate, timeFormat === '12h' ? 'h:mm a' : 'HH:mm')}
              </p>
            </div>
            <div>
              <span className="text-xs text-neutral-600">Venue:</span>
              <p className="text-sm font-semibold">{invoice.venue}</p>
            </div>
            <div>
              <span className="text-xs text-neutral-600">City:</span>
              <p className="text-sm font-semibold">{invoice.city || 'Not specified'}</p>
            </div>
            <div>
              <span className="text-xs text-neutral-600">Sport:</span>
              <p className="text-sm font-semibold capitalize">{invoice.sport}</p>
            </div>
            {invoice.category && (
              <div>
                <span className="text-xs text-neutral-600">Category:</span>
                <p className="text-sm font-semibold">{invoice.category}</p>
              </div>
            )}
            {invoice.team && (
              <div>
                <span className="text-xs text-neutral-600">Team:</span>
                <p className="text-sm font-semibold">{invoice.team}</p>
              </div>
            )}
          </div>
        </div>
        
        <div>
          <h3 className="text-xs font-semibold text-neutral-900 mb-2">Additional Information</h3>
          <div className="space-y-1">
            <div>
              <span className="text-xs text-neutral-600">Status:</span>
              <p className="text-sm font-semibold capitalize">{invoice.status?.toLowerCase() || 'Active'}</p>
            </div>
            {invoice.description && (
              <div>
                <span className="text-xs text-neutral-600">Description:</span>
                <p className="text-sm font-semibold">{invoice.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Service Items */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-neutral-900 mb-3">Service Items</h3>
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <div className="bg-neutral-50 px-3 py-2 border-b border-neutral-200">
            <div className="grid grid-cols-4 gap-4 text-xs font-semibold text-neutral-700">
              <div>Description</div>
              <div className="text-center">Quantity</div>
              <div className="text-right">Unit Price</div>
              <div className="text-right">Total</div>
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="grid grid-cols-4 gap-4 text-xs">
              <div>
                <p className="font-medium">Professional Services</p>
                <p className="text-xs text-neutral-600">{invoice.homeTeam} vs {invoice.awayTeam}</p>
              </div>
              <div className="text-center">1</div>
              <div className="text-right">$250.00</div>
              <div className="text-right font-semibold">$250.00</div>
            </div>
          </div>
        </div>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-48">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Subtotal:</span>
              <span>$250.00</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Tax (0%):</span>
              <span>$0.00</span>
            </div>
            <hr className="border-neutral-200" />
            <div className="flex justify-between text-sm font-semibold">
              <span>Total:</span>
              <span>$250.00</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-neutral-200 pt-6">
        <div className="grid grid-cols-2 gap-8 text-xs text-neutral-600">
          <div>
            <h4 className="font-semibold text-neutral-900 mb-2">Payment Terms</h4>
            <p>Payment due within 30 days of invoice date.</p>
            <p>Late payments may incur additional charges.</p>
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900 mb-2">Contact Information</h4>
            <p>The Company 25</p>
            <p>Email: billing@company25.com</p>
            <p>Phone: +1 (555) 123-4567</p>
          </div>
        </div>
      </div>
    </div>
  );
}