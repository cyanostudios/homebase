import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { useInvoiceCategories } from "@/context/invoice-categories-context";
import { CategoryManager } from "@/components/settings/category-manager";

export function InvoiceCategoriesSettings() {
  const { invoiceCategories, addInvoiceCategory, removeInvoiceCategory, isLoading } = useInvoiceCategories();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Trophy className="h-5 w-5 mr-2 text-green-600" />
          Invoice Categories
        </CardTitle>
        <CardDescription>
          Configure available categories for invoice types.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CategoryManager
          categories={invoiceCategories}
          addCategory={addInvoiceCategory}
          removeCategory={removeInvoiceCategory}
          placeholder="Add new invoice category..."
          label="Categories"
        />
      </CardContent>
    </Card>
  );
}