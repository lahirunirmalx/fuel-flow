export type FuelPriceRow = { name: string; lkrPerLiter: number };

export type FuelPricesPayload = {
  governmentPrices: FuelPriceRow[];
  privatePrices: FuelPriceRow[];
  sourceSummary?: string;
};
