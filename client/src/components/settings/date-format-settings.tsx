import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "lucide-react";
import { useDateFormat } from "@/context/date-format-context";
import { DateFormat } from "@/lib/date-utils";

export function DateFormatSettings() {
  const { dateFormat, setDateFormat } = useDateFormat();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-green-600" />
          Date Format
        </CardTitle>
        <CardDescription>
          Set the format for displaying dates throughout the application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select 
          value={dateFormat} 
          onValueChange={(value) => setDateFormat(value as DateFormat)}
        >
          <SelectTrigger className="h-10 text-sm">
            <SelectValue placeholder="Select date format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DateFormat.US}>US Format (Aug 16, 2025)</SelectItem>
            <SelectItem value={DateFormat.EUROPEAN}>European Format (16 Aug, 2025)</SelectItem>
          </SelectContent>
        </Select>
        <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3">
          <p className="text-xs text-neutral-600 font-medium">Preview</p>
          <p className="text-sm text-neutral-900 mt-1">
            {dateFormat === DateFormat.US ? "Aug 16, 2025" : "16 Aug, 2025"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}