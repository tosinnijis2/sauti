import catalogue from "./country-catalogue.json";

// A shared snapshot avoids ICU-version differences during client hydration.
export const countries = catalogue;
const names = new Map(countries.map(country => [country.code, country.name]));
export const isCountry = (value: string) => names.has(value);
export const countryName = (code: string | null | undefined) => code ? names.get(code) ?? "Country not set" : "Country not set";
