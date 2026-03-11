type PageTitleProps = {
  title: string;
  subtitle?: string;
};

export function PageTitle({ title, subtitle }: PageTitleProps) {
  return (
    <div className="os-page-title">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </div>
  );
}