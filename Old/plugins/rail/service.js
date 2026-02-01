// plugins/rail/service.js
/* eslint-disable no-console */

// Trafikverket JSON endpoint (XML in, JSON out)
const API_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json';

// ----- Auth -----
function getApiKey() {
  const key = process.env.TV_API_KEY;
  if (!key) throw new Error('TV_API_KEY not set');
  return key;
}

// ----- Simple in-memory cache for stations -----
const stationsCache = {
  data: null,
  fetchedAt: 0,
  ttlMs: 24 * 60 * 60 * 1000, // 24h
};

// ----- Low-level fetch -----
async function tvFetch(xmlBody) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xmlBody,
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error('Trafikverket HTTP error:', res.status, res.statusText);
    console.error('Response body (truncated):', raw.slice(0, 2000));
    throw new Error(`Trafikverket HTTP ${res.status}`);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse Trafikverket JSON:', e);
    console.error('Response body (truncated):', raw.slice(0, 2000));
    throw new Error('Invalid JSON from Trafikverket');
  }

  const result = json?.RESPONSE?.RESULT?.[0];
  if (!result) {
    console.error('Unexpected Trafikverket structure:', json);
    throw new Error('Unexpected Trafikverket response');
  }
  return result;
}

// ====== Announcements ======
function makeAnnouncementsXML({ key, stationCode, activityType, fromISO, toISO }) {
  return `
<REQUEST>
  <LOGIN authenticationkey="${key}"/>
  <QUERY objecttype="TrainAnnouncement" schemaversion="1.9" limit="500">
    <FILTER>
      <EQ name="LocationSignature" value="${stationCode}"/>
      <EQ name="Advertised" value="true"/>
      <EQ name="ActivityType" value="${activityType}"/>
      <GT name="AdvertisedTimeAtLocation" value="${fromISO}"/>
      <LT name="AdvertisedTimeAtLocation" value="${toISO}"/>
    </FILTER>
    <INCLUDE>AdvertisedTrainIdent</INCLUDE>
    <INCLUDE>AdvertisedTimeAtLocation</INCLUDE>
    <INCLUDE>EstimatedTimeAtLocation</INCLUDE>
    <INCLUDE>ToLocation</INCLUDE>
    <INCLUDE>FromLocation</INCLUDE>
    <INCLUDE>TrackAtLocation</INCLUDE>
    <INCLUDE>ActivityType</INCLUDE>
    <INCLUDE>Deviation</INCLUDE>
  </QUERY>
</REQUEST>`.trim();
}

async function fetchAnnouncementsFor(stationCode, activityType, { hoursBack = 1, hoursAhead = 12 } = {}) {
  const key = getApiKey();
  const now = Date.now();
  const fromISO = new Date(now - hoursBack * 60 * 60 * 1000).toISOString();
  const toISO = new Date(now + hoursAhead * 60 * 60 * 1000).toISOString();

  const xml = makeAnnouncementsXML({ key, stationCode, activityType, fromISO, toISO });
  const result = await tvFetch(xml);
  return result.TrainAnnouncement || [];
}

function toMs(a) {
  return a
    ? new Date(a).getTime()
    : 0;
}

function nextTime(advertised, estimated) {
  // Prefer estimated if present
  return toMs(estimated || advertised);
}

async function fetchAnnouncements(stationCode) {
  // Query departures and arrivals separately to avoid 500-item cap hiding future departures
  const [dep, arr] = await Promise.all([
    fetchAnnouncementsFor(stationCode, 'Avgang', { hoursBack: 1, hoursAhead: 12 }),
    fetchAnnouncementsFor(stationCode, 'Ankomst', { hoursBack: 1, hoursAhead: 12 }),
  ]);

  const combined = [...dep, ...arr];

  // Sort by effective time ascending
  combined.sort((a, b) => {
    const ta = nextTime(a.AdvertisedTimeAtLocation, a.EstimatedTimeAtLocation);
    const tb = nextTime(b.AdvertisedTimeAtLocation, b.EstimatedTimeAtLocation);
    return ta - tb;
  });

  return combined;
}

async function getAnnouncements(stationCode) {
  return fetchAnnouncements(stationCode);
}

// ====== Stations ======
async function fetchStations() {
  const key = getApiKey();
  const xml = `
<REQUEST>
  <LOGIN authenticationkey="${key}"/>
  <QUERY objecttype="TrainStation" schemaversion="1.4">
    <FILTER>
      <EQ name="Advertised" value="true"/>
    </FILTER>
    <INCLUDE>LocationSignature</INCLUDE>
    <INCLUDE>AdvertisedLocationName</INCLUDE>
    <INCLUDE>AdvertisedShortLocationName</INCLUDE>
    <INCLUDE>CountryCode</INCLUDE>
    <INCLUDE>CountyNo</INCLUDE>
    <INCLUDE>ModifiedTime</INCLUDE>
  </QUERY>
</REQUEST>`.trim();

  const result = await tvFetch(xml);
  const list = result.TrainStation || [];

  return list
    .map(s => ({
      code: s.LocationSignature,
      name: s.AdvertisedLocationName,
      shortName: s.AdvertisedShortLocationName,
      country: s.CountryCode,
      countyNo: s.CountyNo,
      modified: s.ModifiedTime,
    }))
    .filter(s => s.code && s.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'));
}

async function getStations({ force = false } = {}) {
  const now = Date.now();
  const valid = stationsCache.data && now - stationsCache.fetchedAt < stationsCache.ttlMs;
  if (!force && valid) {
    return stationsCache.data;
  }
  const data = await fetchStations();
  stationsCache.data = data;
  stationsCache.fetchedAt = now;
  return data;
}

module.exports = {
  getAnnouncements,
  getStations,
};
