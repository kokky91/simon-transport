import { BaseEvent } from "./base";

export type MarketPriceUpdated = BaseEvent<
  "MARKET_PRICE_UPDATED",
  {
    cropId: string;
    newPrice: number;
  }
>;
