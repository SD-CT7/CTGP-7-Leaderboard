export const REGION_DATA = { /* ... 既存のまま ... */ };
export const SELECTABLE_REGIONS = ["Asia", "Europe", "Africa", "Oceania", "North America"];

export const COUNTRY_TO_REGION = {};
Object.keys(REGION_DATA).forEach(region => {
  REGION_DATA[region].forEach(c => { COUNTRY_TO_REGION[c.code] = region; });
});
