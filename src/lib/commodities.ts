export const COMMODITIES = ["MAIZE", "RICE", "BEANS", "WHEAT", "CASSAVA", "POTATOES", "TOMATOES", "ONIONS", "BANANAS", "COFFEE"] as const;
export type Commodity = typeof COMMODITIES[number];
export const COMMODITY_LABELS: Record<Commodity, string> = { MAIZE: "Maize", RICE: "Rice", BEANS: "Beans", WHEAT: "Wheat", CASSAVA: "Cassava", POTATOES: "Potatoes", TOMATOES: "Tomatoes", ONIONS: "Onions", BANANAS: "Bananas", COFFEE: "Coffee" };
export const VARIETIES = ["WHITE", "YELLOW", "BASMATI", "LONG_GRAIN"] as const;
export type Variety = typeof VARIETIES[number];
export const VARIETY_LABELS: Record<Variety, string> = { WHITE: "White", YELLOW: "Yellow", BASMATI: "Basmati", LONG_GRAIN: "Long grain" };
export const COMMODITY_VARIETIES: Record<Commodity, readonly Variety[]> = { MAIZE: ["WHITE", "YELLOW"], RICE: ["BASMATI", "LONG_GRAIN"], BEANS: [], WHEAT: [], CASSAVA: [], POTATOES: [], TOMATOES: [], ONIONS: [], BANANAS: [], COFFEE: [] };
export const GRADES = ["GRADE_1", "GRADE_2", "STANDARD"] as const;
export type Grade = typeof GRADES[number];
export const GRADE_LABELS: Record<Grade, string> = { GRADE_1: "Grade 1", GRADE_2: "Grade 2", STANDARD: "Standard" };

export function structuredSearch(q: string) {
  const term = q.toLowerCase();
  return {
    commodities: COMMODITIES.filter(value => COMMODITY_LABELS[value].toLowerCase().includes(term)),
    varieties: VARIETIES.filter(value => VARIETY_LABELS[value].toLowerCase().includes(term)),
    grades: GRADES.filter(value => GRADE_LABELS[value].toLowerCase().includes(term)),
  };
}

export function cohortLabel(commodity: Commodity, variety: Variety | null, grade: Grade | null) {
  return [COMMODITY_LABELS[commodity], variety ? VARIETY_LABELS[variety] : "Variety unspecified", grade ? GRADE_LABELS[grade] : "Grade unspecified"].join(" / ");
}
