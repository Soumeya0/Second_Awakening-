// Top of every in-app page: coloured eyebrow, title, one-line subtitle, optional action on the right.
export default function PageHeader({ eyebrow, color = 'var(--blue)', title, sub, action }) {
  return (
    <div className="row between wrap" style={{ gap: 16, alignItems: 'flex-end' }}>
      <header className="page-head">
        <span className="eyebrow row" style={{ color, gap: 8 }}>{eyebrow}</span>
        <h1 className="page-title">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </header>
      {action}
    </div>
  );
}
