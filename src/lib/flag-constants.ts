// Country code to name mapping
export const COUNTRIES = {
  AE: "United Arab Emirates",
  AL: "Albania",
  AO: "Angola",
  AR: "Argentina",
  AT: "Austria",
  AU: "Australia",
  BE: "Belgium",
  BG: "Bulgaria",
  CA: "Canada",
  CH: "Switzerland",
  CN: "China",
  CU: "Cuba",
  CZ: "Czech Republic",
  DE: "Germany",
  DK: "Denmark",
  DV: "Divehi",
  EG: "Egypt",
  ES: "Spain",
  FR: "France",
  GB: "Great Britain",
  IE: "Ireland",
  IN: "India",
  IQ: "Iraq",
  IT: "Italy",
  KW: "Kuwait",
  MX: "Mexico",
  NL: "Netherlands",
  PH: "Philippines",
  PL: "Poland",
  PR: "Puerto Rico",
  PT: "Portugal",
  PU: "Punjab",
  QA: "Qatar",
  RO: "Romania",
  SA: "Saudi Arabia",
  SK: "Slovakia",
  TT: "Trinidad and Tobago",
  UK: "United Kingdom",
  US: "United States",
  ZA: "South Africa",
  ZW: "Zimbabwe",
} as const;

// State code to name mapping (US and Canada states/provinces)
export const STATES = {
  AB: "Alberta",
  AK: "Alaska",
  AL: "Alabama",
  ALB: "Albania",
  AR: "Arkansas",
  AZ: "Arizona",
  BC: "British Columbia",
  CA: "California",
  CN: "Connecticut",
  CO: "Colorado",
  CT: "Connecticut",
  DC: "District of Columbia",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  GE: "Georgia",
  HI: "Hawaii",
  IA: "Iowa",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IO: "Iowa",
  JA: "Jamaica",
  KA: "Kansas",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  LS: "Louisiana",
  MA: "Massachusetts",
  MB: "Manitoba",
  MD: "Maryland",
  ME: "Maine",
  MI: "Michigan",
  MN: "Minnesota",
  MO: "Missouri",
  MS: "Mississippi",
  MT: "Montana",
  NB: "New Brunswick",
  NC: "North Carolina",
  ND: "North Dakota",
  NE: "Nebraska",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NS: "Nova Scotia",
  NT: "Northwest Territories",
  NU: "Nunavut",
  NV: "Nevada",
  NY: "New York",
  OH: "Ohio",
  OK: "Oklahoma",
  ON: "Ontario",
  OR: "Oregon",
  PA: "Pennsylvania",
  PE: "Prince Edward Island",
  PO: "Poland",
  PR: "Puerto Rico",
  QC: "Quebec",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TW: "Taiwan",
  TX: "Texas",
  UT: "Utah",
  VA: "Virginia",
  VI: "Virgin Islands",
  VT: "Vermont",
  WA: "Washington",
  WI: "Wisconsin",
  WV: "West Virginia",
  WY: "Wyoming",
  YT: "Yukon",
} as const;

export type CountryCode = keyof typeof COUNTRIES;
export type StateCode = keyof typeof STATES;

export const getCountryFlag = (code: string | null | undefined) => {
  if (!code) return null;
  const upperCode = code.toUpperCase();
  if (upperCode in COUNTRIES) {
    return `/countryflags/${upperCode}.gif`;
  }
  return null;
};

export const getStateFlag = (code: string | null | undefined) => {
  if (!code) return null;
  const upperCode = code.toUpperCase();
  if (upperCode in STATES) {
    return `/stateflags/${upperCode}.gif`;
  }
  return null;
};

export const getCountryName = (code: string | null | undefined) => {
  if (!code) return "";
  const upperCode = code.toUpperCase() as CountryCode;
  return COUNTRIES[upperCode] || code;
};

export const getStateName = (code: string | null | undefined) => {
  if (!code) return "";
  const upperCode = code.toUpperCase() as StateCode;
  return STATES[upperCode] || code;
};
