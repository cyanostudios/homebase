import { useEffect, useState } from 'react';

import { getTimeFormat, subscribeTimeFormat, type TimeFormat } from './timeFormatPreference';

/** Subscribe to platform Preferences timeFormat for React re-renders. */
export function useTimeFormat(): TimeFormat {
  const [format, setFormat] = useState<TimeFormat>(getTimeFormat);

  useEffect(() => subscribeTimeFormat(() => setFormat(getTimeFormat())), []);

  return format;
}
