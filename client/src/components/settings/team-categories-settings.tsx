import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { useTeamCategories } from "@/context/team-categories-context";
import { CategoryManager } from "@/components/settings/category-manager";

export function TeamCategoriesSettings() {
  const { teamCategories, addTeamCategory, removeTeamCategory, isLoading } = useTeamCategories();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Users className="h-5 w-5 mr-2 text-blue-600" />
          Team Categories
        </CardTitle>
        <CardDescription>
          Configure available team categories for matches.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <CategoryManager
          categories={teamCategories}
          addCategory={addTeamCategory}
          removeCategory={removeTeamCategory}
          placeholder="Add new team category..."
          label="Teams"
        />
      </CardContent>
    </Card>
  );
}