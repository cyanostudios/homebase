import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useTimeFormat } from "@/context/time-format-context";
import { TimeFormat } from "@/lib/date-utils";

export function TimeFormatSettings() {
  const { timeFormat, setTimeFormat } = useTimeFormat();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Clock className="h-5 w-5 mr-2 text-blue-600" />
          Time Format
        </CardTitle>
        <CardDescription>
          Configure how time is displayed throughout the application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select 
          value={timeFormat} 
          onValueChange={(value) => setTimeFormat(value as TimeFormat)}
        >
          <SelectTrigger className="h-10 text-sm">
            <SelectValue placeholder="Select time format" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TimeFormat.HOUR_12}>12-hour format (AM/PM)</SelectItem>
            <SelectItem value={TimeFormat.HOUR_24}>24-hour format</SelectItem>
          </SelectContent>
        </Select>
        <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3">
          <p className="text-xs text-neutral-600 font-medium">Preview</p>
          <p className="text-sm text-neutral-900 mt-1">
            {timeFormat === TimeFormat.HOUR_12 ? '3:45 PM' : '15:45'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}