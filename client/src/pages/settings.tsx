import { AppContainer } from "@/components/layout/app-container";
import { TimeFormatSettings } from "@/components/settings/time-format-settings";
import { DateFormatSettings } from "@/components/settings/date-format-settings";
import { DefaultCitySettings } from "@/components/settings/default-city-settings";

export default function Settings() {
  return (
    <AppContainer>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-neutral-600">
            Configure application preferences and platform settings.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <TimeFormatSettings />
          <DateFormatSettings />
          <DefaultCitySettings />
        </div>
      </div>
    </AppContainer>
  );
}