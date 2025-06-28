import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { useCity } from "@/context/city-context";

export function DefaultCitySettings() {
  const { defaultCity, setDefaultCity } = useCity();
  const [cityInput, setCityInput] = useState("");

  const handleSaveCity = () => {
    if (cityInput.trim()) {
      setDefaultCity(cityInput.trim());
      setCityInput("");
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <MapPin className="h-5 w-5 mr-2 text-orange-600" />
          Default City
        </CardTitle>
        <CardDescription>
          Set the default city for matches and weather forecasts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3">
          <Input 
            type="text" 
            placeholder="Enter city name"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            className="flex-1 h-10 text-sm"
          />
          <Button 
            onClick={handleSaveCity}
            size="sm"
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap flex items-center space-x-2"
          >
            <MapPin className="h-3 w-3" />
            <span>Save</span>
          </Button>
        </div>
        <div className="bg-neutral-50 border border-neutral-200 rounded-md p-3">
          <p className="text-xs text-neutral-600 font-medium">Current Default</p>
          <p className="text-sm text-neutral-900 mt-1">{defaultCity}</p>
        </div>
      </CardContent>
    </Card>
  );
}