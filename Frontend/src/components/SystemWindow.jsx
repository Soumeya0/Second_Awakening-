// The "System" panel: glowing frame, corner brackets, a diamond on top, optional "! TITLE" header.
export const AlertIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" /><path d="M12 7v6.5" /><circle cx="12" cy="16.8" r=".6" fill="currentColor" />
  </svg>
);

export default function SystemWindow({ title, icon = <AlertIcon />, tone = 'blue', className = '', children, ...rest }) {
  return (
    <section className={`sys-window tone-${tone} ${className}`} aria-label={rest['aria-label'] || title} {...rest}>
      <span className="sw-corner tl" /><span className="sw-corner tr" /><span className="sw-corner bl" /><span className="sw-corner br" />
      {title && (
        <header className="sw-head">
          {icon && <span className="sw-icon">{icon}</span>}
          <h2 className="sw-title">{title}</h2>
        </header>
      )}
      {children}
    </section>
  );
}
