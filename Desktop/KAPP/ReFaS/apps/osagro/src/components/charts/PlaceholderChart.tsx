type PlaceholderChartProps = {
  label: string;
};

export function PlaceholderChart({ label }: PlaceholderChartProps) {
  return (
    <section className="os-chart-placeholder">
      <strong>{label}</strong>
      <p>Chart placeholder for dashboard metrics.</p>
    </section>
  );
}