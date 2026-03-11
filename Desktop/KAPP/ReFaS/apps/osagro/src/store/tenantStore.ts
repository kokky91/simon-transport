import { create } from "zustand";

type TenantState = {
  tenantId: string | null;
  setTenantId: (tenantId: string) => void;
  clearTenant: () => void;
};

export const useTenantStore = create<TenantState>((set) => ({
  tenantId: null,
  setTenantId: (tenantId) => set({ tenantId }),
  clearTenant: () => set({ tenantId: null })
}));