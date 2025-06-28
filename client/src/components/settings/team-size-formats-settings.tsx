import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { useTeamSizeFormats } from "@/context/team-size-formats-context";
import { CategoryManager } from "@/components/settings/category-manager";

export function TeamSizeFormatsSettings() {
  const { teamSizeFormats, addTeamSizeFormat, removeTeamSizeFormat, isLoading } = useTeamSizeFormats();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Users className="h-5 w-5 mr-2 text-cyan-600" />
          Team Size Formats
        </CardTitle>
        <CardDescription>
          Configure available team size formats for matches (e.g., 11v11, 7v7).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CategoryManager
          categories={teamSizeFormats}
          addCategory={addTeamSizeFormat}
          removeCategory={removeTeamSizeFormat}
          placeholder="Add team size format (e.g., 5v5)..."
          label="Formats"
        />
      </CardContent>
    </Card>
  );
}