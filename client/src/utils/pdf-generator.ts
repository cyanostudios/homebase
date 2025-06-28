import html2pdf from 'html2pdf.js';
import { Invoice } from '@shared/schema';

export interface PDFOptions {
  margin: number | [number, number, number, number];
  filename: string;
  image: { type: string; quality: number };
  html2canvas: { 
    scale: number;
    useCORS: boolean;
    letterRendering: boolean;
  };
  jsPDF: { unit: string; format: string; orientation: string };
}

export const defaultPDFOptions: PDFOptions = {
  margin: [10, 10, 10, 10],
  filename: 'invoice.pdf',
  image: { type: 'jpeg', quality: 0.98 },
  html2canvas: { 
    scale: 2,
    useCORS: true,
    letterRendering: true
  },
  jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
};

export async function generateInvoicePDF(
  elementId: string, 
  invoice: Invoice, 
  options: Partial<PDFOptions> = {}
): Promise<void> {
  const element = document.getElementById(elementId);
  
  if (!element) {
    throw new Error(`Element with ID ${elementId} not found`);
  }

  const finalOptions = {
    ...defaultPDFOptions,
    ...options,
    filename: options.filename || `invoice-${invoice.id.toString().padStart(6, '0')}.pdf`
  };

  try {
    await html2pdf()
      .set(finalOptions)
      .from(element)
      .save();
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
}

export async function generateInvoicePDFBlob(
  elementId: string, 
  invoice: Invoice, 
  options: Partial<PDFOptions> = {}
): Promise<Blob> {
  const element = document.getElementById(elementId);
  
  if (!element) {
    throw new Error(`Element with ID ${elementId} not found`);
  }

  const finalOptions = {
    ...defaultPDFOptions,
    ...options
  };

  try {
    const pdf = await html2pdf()
      .set(finalOptions)
      .from(element)
      .output('blob');
    
    return pdf;
  } catch (error) {
    console.error('Error generating PDF blob:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
}