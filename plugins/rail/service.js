// plugins/rail/service.js
const API_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json';

function getApiKey() {
  const key = process.env.TV_API_KEY;
  if (!key) throw new Error('TV_API_KEY not set');
  return key;
}

// ---- In-memory cache ----
const stationsCache = {
  data: null,
  fetchedAt: 0,
  ttlMs: 24 * 60 * 60 * 1000, // 24h
};

async function tvFetch(xmlBody) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml' },
    body: xmlBody,
  });

  const raw = await res.text();
  if (!res.ok) {
    console.error('Trafikverket HTTP error:', res.status, res.statusText);
    console.error('Response body:', raw.slice(0, 2000));
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

// --------- Announcements ----------
async function fetchAnnouncements(stationCode) {
  const key = getApiKey();
  const xml = `
<REQUEST>
  <LOGIN authenticationkey="${key}"/>
  <QUERY objecttype="TrainAnnouncement" schemaversion="1.9" limit="100">
    <FILTER>
      <EQ name="LocationSignature" value="${stationCode}"/>
      <EQ name="Advertised" value="true"/>
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
</REQUEST>`;
  const result = await tvFetch(xml);
  return result.TrainAnnouncement || [];
}

async function getAnnouncements(stationCode) {
  return fetchAnnouncements(stationCode);
}

// --------- Stations ----------
// --------- Stations (pin v1.4 + INCLUDE) ----------
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
  </REQUEST>`;
  
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
