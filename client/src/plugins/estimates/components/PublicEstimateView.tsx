import React, { useState, useEffect } from 'react';
import { Calendar, Building, FileText, Calculator, Clock, Eye } from 'lucide-react';
import { Card } from '@/core/ui/Card';
import { Heading } from '@/core/ui/Typography';
import { PublicEstimate, calculateEstimateTotals } from '../types/estimate';
import { estimateShareApi } from '../api/estimatesApi';

interface PublicEstimateViewProps {
  token: string;
}

export function PublicEstimateView({ token }: PublicEstimateViewProps) {
  const [estimate, setEstimate] = useState<PublicEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    loadEstimate();
  }, [token]);

  const loadEstimate = async () => {
    try {
      setLoading(true);
      const publicEstimate = await estimateShareApi.getPublicEstimate(token);
      setEstimate(publicEstimate);
    } catch (error) {
      console.error('Failed to load public estimate:', error);
      setError(error instanceof Error ? error.message : 'Failed to load estimate');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-600">Loading estimate...</div>
        </div>
      </div>
    );
  }

  if (error || !estimate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <Card padding="lg" className="text-center">
            <div className="text-red-500 mb-4">
              <FileText className="w-16 h-16 mx-auto opacity-50" />
            </div>
            <Heading level={2} className="text-xl font-semibold text-gray-900 mb-2">
              Estimate Not Available
            </Heading>
            <p className="text-gray-600 mb-4">
              {error || 'This estimate could not be found or the share link has expired.'}
            </p>
            <a 
              href="/"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Go to Homepage
            </a>
          </Card>
        </div>
      </div>
    );
  }

  const totals = calculateEstimateTotals(estimate.lineItems || []);
  const isExpired = new Date(estimate.shareValidUntil) < new Date();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Heading level={1} className="text-2xl font-bold text-gray-900">
                Business Estimate
              </Heading>
              <p className="text-gray-600 mt-1">Professional estimate viewing portal</p>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Estimate Number</div>
              <div className="text-lg font-semibold text-gray-900">{estimate.estimateNumber}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          
          {/* Share Status */}
          <Card padding="sm" className="bg-blue-50 border-blue-200">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-blue-700">
                <Eye className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Public View • Accessed {estimate.accessedCount} times
                </span>
              </div>
              <div className="text-sm text-blue-600">
                <Clock className="w-4 h-4 inline mr-1" />
                {isExpired ? 'Link Expired' : `Valid until ${new Date(estimate.shareValidUntil).toLocaleDateString()}`}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column - Estimate Details */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Customer Information */}
              <Card padding="md">
                <Heading level={3} className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building className="w-5 h-5" />
                  Customer Details
                </Heading>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Customer</div>
                    <div className="text-base font-medium text-gray-900">{estimate.contactName}</div>
                  </div>
                  {estimate.organizationNumber && (
                    <div>
                      <div className="text-sm text-gray-500">Organization Number</div>
                      <div className="text-base text-gray-900">{estimate.organizationNumber}</div>
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-gray-500">Currency</div>
                    <div className="text-base text-gray-900">{estimate.currency}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Valid Until</div>
                    <div className="text-base text-gray-900 flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {new Date(estimate.validTo).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Line Items */}
              <Card padding="md">
                <Heading level={3} className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Items & Services
                </Heading>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left text-sm font-medium text-gray-500 uppercase tracking-wider py-3">Description</th>
                        <th className="text-right text-sm font-medium text-gray-500 uppercase tracking-wider py-3 min-w-[80px]">Qty</th>
                        <th className="text-right text-sm font-medium text-gray-500 uppercase tracking-wider py-3 min-w-[100px]">Unit Price</th>
                        <th className="text-right text-sm font-medium text-gray-500 uppercase tracking-wider py-3 min-w-[80px]">Discount</th>
                        <th className="text-right text-sm font-medium text-gray-500 uppercase tracking-wider py-3 min-w-[80px]">VAT</th>
                        <th className="text-right text-sm font-medium text-gray-500 uppercase tracking-wider py-3 min-w-[100px]">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {estimate.lineItems.map((item, index) => (
                        <tr key={item.id || index}>
                          <td className="py-4 text-sm text-gray-900">{item.description}</td>
                          <td className="py-4 text-sm text-gray-900 text-right">{item.quantity}</td>
                          <td className="py-4 text-sm text-gray-900 text-right">{item.unitPrice.toFixed(2)} {estimate.currency}</td>
                          <td className="py-4 text-sm text-gray-900 text-right">{item.discount}%</td>
                          <td className="py-4 text-sm text-gray-900 text-right">{item.vatRate}%</td>
                          <td className="py-4 text-sm font-medium text-gray-900 text-right">{item.lineTotal.toFixed(2)} {estimate.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Notes */}
              {estimate.notes && (
                <Card padding="md">
                  <Heading level={3} className="text-lg font-semibold text-gray-900 mb-4">Notes</Heading>
                  <div className="text-gray-900 whitespace-pre-wrap">{estimate.notes}</div>
                </Card>
              )}
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-6">
              
              {/* Status */}
              <Card padding="md">
                <Heading level={3} className="text-lg font-semibold text-gray-900 mb-4">Status</Heading>
                <div className="text-center">
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${
                    estimate.status === 'draft' ? 'bg-gray-100 text-gray-800' :
                    estimate.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                    estimate.status === 'accepted' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {estimate.status.charAt(0).toUpperCase() + estimate.status.slice(1)}
                  </span>
                </div>
              </Card>

              {/* Total Summary */}
              <Card padding="md">
                <Heading level={3} className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  Summary
                </Heading>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="font-medium">{totals.subtotal.toFixed(2)} {estimate.currency}</span>
                  </div>
                  
                  {totals.totalDiscount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Discounts:</span>
                      <span className="font-medium text-red-600">-{totals.totalDiscount.toFixed(2)} {estimate.currency}</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">After Discounts:</span>
                    <span className="font-medium">{totals.subtotalAfterDiscount.toFixed(2)} {estimate.currency}</span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-gray-600">VAT:</span>
                    <span className="font-medium">{totals.totalVat.toFixed(2)} {estimate.currency}</span>
                  </div>
                  
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total:</span>
                      <span>{totals.total.toFixed(2)} {estimate.currency}</span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Company Contact */}
              <Card padding="md">
                <Heading level={3} className="text-lg font-semibold text-gray-900 mb-4">Contact Us</Heading>
                <div className="space-y-2 text-sm">
                  <div>
                    <div className="text-gray-500">Company</div>
                    <div className="font-medium">Professional Services Ltd</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Email</div>
                    <a href="mailto:hello@company.com" className="text-blue-600 hover:text-blue-800">
                      hello@company.com
                    </a>
                  </div>
                  <div>
                    <div className="text-gray-500">Phone</div>
                    <a href="tel:+1234567890" className="text-blue-600 hover:text-blue-800">
                      +1 (234) 567-8900
                    </a>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center py-8 border-t border-gray-200">
            <p className="text-gray-500 text-sm">
              Generated on {new Date(estimate.createdAt).toLocaleDateString()} • 
              This estimate is valid until {new Date(estimate.validTo).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}