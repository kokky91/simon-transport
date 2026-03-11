import { useTenantStore } from "../../store/tenantStore";

export function useTenantHeaders() {
  const tenantId = useTenantStore((state) => state.tenantId);

  return tenantId
    ? {
        "X-Tenant-Id": tenantId
      }
    : {};
}