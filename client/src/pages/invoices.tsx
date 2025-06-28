import { AppContainer } from "@/components/layout/app-container";
import { InvoiceTable } from "@/components/invoices/invoice-table";

export default function Invoices() {
  return (
    <>
      <AppContainer>
        <InvoiceTable />
      </AppContainer>

      {/* Sliding panels - now handled globally in App.tsx */}
    </>
  );
}