export type TenantScopedRequest = {
  tenantId: string;
};

export type ApiResult<TData> = {
  data: TData;
};