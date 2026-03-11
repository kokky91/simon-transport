export interface BaseEvent<TType extends string, TPayload> {
  type: TType;
  version: 1;
  timestamp: string;
  traceId: string;
  tenantId: string;
  payload: TPayload;
}
