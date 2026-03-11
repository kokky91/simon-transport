import { BaseEvent } from "./base";

export type CompostProduced = BaseEvent<
  "COMPOST_PRODUCED",
  {
    entityId: string;
    resource: string;
    producedAmount: number;
    totalStored: number;
  }
>;
