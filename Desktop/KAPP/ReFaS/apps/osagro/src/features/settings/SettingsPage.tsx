import { PageTitle } from "../../components/ui/PageTitle";

export function SettingsPage() {
  return (
    <section>
      <PageTitle title="Settings" subtitle="Configure organization-level settings and user preferences." />
      <p>Tenant-level and user-level settings stay separated in this module.</p>
    </section>
  );
}