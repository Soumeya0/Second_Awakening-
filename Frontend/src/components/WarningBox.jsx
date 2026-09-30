// Red penalty panel — the "WARNING · NO RESET BUTTON" box.
export default function WarningBox({ title = 'WARNING', lead, detail, children }) {
  return (
    <section className="warn-box" aria-label={title}>
      <svg className="warn-icon" width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3 2.5 20h19Z" /><path d="M12 9.5v5" strokeLinecap="round" /><circle cx="12" cy="17.2" r=".7" fill="currentColor" />
      </svg>
      <div className="col" style={{ gap: 4, minWidth: 0 }}>
        <h3 className="warn-title">{title}</h3>
        {lead && <p className="warn-lead">{lead}</p>}
        {detail && <p className="warn-detail">{detail}</p>}
        {children}
      </div>
    </section>
  );
}
