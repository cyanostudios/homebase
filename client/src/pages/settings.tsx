import { AppContainer } from "@/components/layout/app-container";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TimeFormatSettings } from "@/components/settings/time-format-settings";
import { DateFormatSettings } from "@/components/settings/date-format-settings";
import { DefaultSportSettings } from "@/components/settings/default-sport-settings";
import { DefaultCitySettings } from "@/components/settings/default-city-settings";
import { InvoiceCategoriesSettings } from "@/components/settings/match-categories-settings";
import { TeamCategoriesSettings } from "@/components/settings/team-categories-settings";
import { TeamSizeFormatsSettings } from "@/components/settings/team-size-formats-settings";

import { QualificationLevelsSettings } from "@/components/settings/qualification-levels-settings";
import { Award } from "lucide-react";

export default function Settings() {
  return (
    <AppContainer>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-neutral-600">
            Configure application preferences and manage system settings.
          </p>
        </div>

        {/* Row 1: Time Format, Date Format, Default Sport */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <TimeFormatSettings />
          <DateFormatSettings />
          <DefaultSportSettings />
        </div>

        {/* Row 2: Default City, Match Categories, Team Categories */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <DefaultCitySettings />
          <InvoiceCategoriesSettings />
          <TeamCategoriesSettings />
        </div>

        {/* Row 3: Team Size Formats, Qualification Levels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TeamSizeFormatsSettings />
          <QualificationLevelsSettings />
        </div>

      </div>
    </AppContainer>
  );
}