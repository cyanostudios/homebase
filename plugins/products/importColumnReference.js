/**
 * Static copy for import column reference UI; dynamic instance IDs are injected by the controller.
 * @typedef {{ name: string; description: string }} ColumnRef
 */

/** @type {ColumnRef[]} */
const GENERAL_COLUMNS = [
  {
    name: 'issello',
    description: 'Sätt till 1 för Sello-kolumnnamn (standardnamesv, propertygtin, …).',
  },
  {
    name: 'sku',
    description: 'Artikelnummer / SKU (obligatoriskt för raden när matchnyckel är SKU).',
  },
  { name: 'id', description: 'Produkt-ID i Homebase (används när matchnyckel är ID).' },
  {
    name: 'gtin',
    description: 'GTIN (används när matchnyckel är GTIN; vid dubbletter används lägsta id).',
  },
  {
    name: 'ean',
    description: 'EAN (används när matchnyckel är EAN; vid dubbletter används lägsta id).',
  },
  {
    name: 'title',
    description: 'Icke-Sello: ignoreras om per-marknadstexter finns; annars titel.',
  },
  { name: 'description', description: 'Icke-Sello: ignoreras om per-marknadstexter finns.' },
  { name: 'title.se', description: 'Svensk titel (icke-Sello, per marknad).' },
  { name: 'description.se', description: 'Svensk beskrivning (icke-Sello).' },
  { name: 'title.dk', description: 'Dansk titel.' },
  { name: 'description.dk', description: 'Dansk beskrivning.' },
  { name: 'title.fi', description: 'Finsk titel.' },
  { name: 'description.fi', description: 'Finsk beskrivning.' },
  { name: 'title.no', description: 'Norsk titel.' },
  { name: 'description.no', description: 'Norsk beskrivning.' },
  { name: 'textsStandard', description: 'Väljer standardmarknad för texter (t.ex. fi, se).' },
  { name: 'status', description: 'for sale eller paused.' },
  { name: 'quantity', description: 'Lagerantal (heltal).' },
  { name: 'priceamount', description: 'Pris (katalog).' },
  { name: 'currency', description: 'Valutakod (t.ex. SEK).' },
  { name: 'vatrate', description: 'Momssats (0–50).' },
  { name: 'brand', description: 'Varumärke (text).' },
  { name: 'mpn', description: 'Tillverkarens artikelnummer.' },
  { name: 'tax', description: 'Sello: moms som decimal (ersätter vatrate för Sello-rader).' },
  { name: 'manufacturerno', description: 'Sello: motsvarar MPN.' },
  { name: 'privateName', description: 'Internt namn (mappas till privatename).' },
  { name: 'purchasePrice', description: 'Inköpspris (purchaseprice).' },
  { name: 'knNumber', description: 'KN-nummer (knnumber).' },
  { name: 'lagerplats', description: 'Lagerplats.' },
  { name: 'condition', description: 'new | used | refurb.' },
  { name: 'color', description: 'Färg.' },
  { name: 'colorText', description: 'Färg (fritext).' },
  { name: 'size', description: 'Storlek.' },
  { name: 'sizeText', description: 'Storlek (fritext).' },
  { name: 'pattern', description: 'Mönster.' },
  { name: 'material', description: 'Material.' },
  { name: 'patternText', description: 'Mönster (fritext).' },
  { name: 'model', description: 'Modell.' },
  { name: 'weight', description: 'Vikt.' },
  { name: 'weightUnit', description: 'kg eller g → channelSpecific.weightUnit.' },
  { name: 'volume', description: 'Volym.' },
  { name: 'volumeUnit', description: 'Volymenhet.' },
  { name: 'notes', description: 'Anteckningar.' },
  { name: 'lengthCm', description: 'Längd cm (lengthcm).' },
  { name: 'widthCm', description: 'Bredd cm (widthcm).' },
  { name: 'heightCm', description: 'Höjd cm (heightcm).' },
  { name: 'depthCm', description: 'Djup cm (depthcm).' },
  { name: 'brandId', description: 'Varumärkes-id (positivt heltal).' },
  { name: 'supplierId', description: 'Leverantörs-id.' },
  { name: 'manufacturerId', description: 'Tillverkar-id.' },
  { name: 'listId', description: 'List-id i Homebase; sätts efter lyckad create/update.' },
  { name: 'mainImage', description: 'Huvudbild URL (http/https, valideras mot image/*).' },
  { name: 'images', description: 'Extra bilder, kommaseparerade URL:er (valideras).' },
  { name: 'categories', description: 'Kategorier, kommaseparerade.' },
  {
    name: 'OBS: SEO per marknad',
    description:
      'Utöver exemplen nedan med .se finns samma kolumnmönster för .dk, .fi och .no: titleseo.<mk>, metadesc.<mk>, metakeywords.<mk>, bulletpoints.<mk> (rubriker normaliseras till gemener utan mellanslag).',
  },
  {
    name: 'titleSeo.se',
    description: 'SEO-titel för marknad (titleseo.se); se även OBS ovan för dk/fi/no.',
  },
  {
    name: 'metaDesc.se',
    description: 'Meta description (metadesc.se); se OBS för andra marknader.',
  },
  {
    name: 'metaKeywords.se',
    description: 'Meta keywords (metakeywords.se); se OBS för andra marknader.',
  },
  {
    name: 'bulletpoints.se',
    description:
      'Flera punkter: kommaseparerade (samma som categories/images). En punkt utan komma i cellen = en enda punkt. Samma mönster för bulletpoints.dk / .fi / .no.',
  },
  {
    name: 'channelSpecificJson',
    description:
      'JSON-objekt; tillåtna nycklar: textsExtended, textsStandard, weightUnit, cdon, fyndiq, woocommerce.',
  },
];

/** @type {ColumnRef[]} */
const SELLO_COLUMNS = [
  { name: 'standardnamesv', description: 'Produktnamn (sv).' },
  { name: 'standarddescriptionsv', description: 'Beskrivning (sv).' },
  { name: 'propertygtin', description: 'GTIN i Sello-export.' },
  { name: 'propertyean', description: 'EAN i Sello-export.' },
  { name: 'tax', description: 'Momssats.' },
  { name: 'manufacturerno', description: 'Tillverkarens artikelnummer.' },
];

/**
 * @param {Array<{ id: string; channel: string; instanceKey: string; market?: string | null; label?: string | null }>} instances
 */
function buildChannelSections(instances) {
  const list = Array.isArray(instances) ? instances : [];
  return list.map((inst) => {
    const ch = String(inst.channel || '').toLowerCase();
    const key = String(inst.instanceKey || '').trim();
    const id = String(inst.id || '').trim();
    const dotBase = key ? `${ch}.${key}` : ch;
    const exampleColumns = [
      `${dotBase}.price`,
      `${dotBase}.active`,
      `${dotBase}.category`,
      `${dotBase}.categories`,
    ];
    /** @type {string[]} */
    const legacyHints = [];
    if (ch === 'cdon' && ['se', 'dk', 'fi'].includes(key)) {
      legacyHints.push(`cdon${key}price${id}`, `cdon${key}active${id}`);
    }
    if (ch === 'fyndiq' && /^\d+$/.test(String(inst.instanceKey || ''))) {
      const code = String(inst.instanceKey);
      legacyHints.push(`fyndiq3price${code}`, `fyndiq3active${code}`);
    }
    if (ch === 'woocommerce' && id) {
      legacyHints.push(`woocommerceprice${id}`);
    }
    return {
      channel: inst.channel,
      instanceKey: inst.instanceKey,
      numericId: id,
      market: inst.market ?? null,
      label: inst.label ?? null,
      exampleColumns,
      legacyHints,
    };
  });
}

/**
 * @param {Array<{ id: string; channel: string; instanceKey: string; market?: string | null; label?: string | null }>} instances
 */
function buildImportColumnReferencePayload(instances) {
  return {
    general: GENERAL_COLUMNS,
    sello: SELLO_COLUMNS,
    channels: buildChannelSections(instances),
  };
}

module.exports = {
  GENERAL_COLUMNS,
  SELLO_COLUMNS,
  buildChannelSections,
  buildImportColumnReferencePayload,
};
