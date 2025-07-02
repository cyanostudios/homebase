import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { useSport } from "@/context/sport-context";

export function DefaultSportSettings() {
  const { defaultSport, setDefaultSport } = useSport();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Trophy className="h-5 w-5 mr-2 text-purple-600" />
          Default Sport
        </CardTitle>
        <CardDescription>
          Set the default sport for new matches and contact assignments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Select value={defaultSport} onValueChange={setDefaultSport}>
          <SelectTrigger className="h-10 text-sm">
            <SelectValue placeholder="Select default sport" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="football">Football (Soccer)</SelectItem>
            <SelectItem value="basketball">Basketball</SelectItem>
            <SelectItem value="handball">Handball</SelectItem>
            <SelectItem value="volleyball">Volleyball</SelectItem>
            <SelectItem value="hockey">Ice Hockey</SelectItem>
          </SelectContent>
        </Select>
        <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3">
          <p className="text-xs text-neutral-600 font-medium">Current Default</p>
          <p className="text-sm text-neutral-900 mt-1 capitalize">
            {defaultSport === 'football' ? 'Football (Soccer)' : 
              defaultSport === 'basketball' ? 'Basketball' : 
              defaultSport === 'handball' ? 'Handball' : 
              defaultSport === 'volleyball' ? 'Volleyball' : 
              defaultSport === 'hockey' ? 'Ice Hockey' : defaultSport}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}