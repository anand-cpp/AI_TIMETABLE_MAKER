import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const Breadcrumb = ({ items = [] }) => {
  return (
    <nav className="flex items-center gap-2 text-xs font-sans text-[var(--text-muted)] mb-4 flex-wrap select-none">
      <Link
        to="/admin"
        className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
      >
        <Home className="w-3.5 h-3.5" strokeWidth={1.5} />
        <span>Home</span>
      </Link>
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <ChevronRight className="w-3 h-3 text-[var(--text-muted)] opacity-60" strokeWidth={1.5} />
          {item.to ? (
            <Link
              to={item.to}
              className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="font-semibold text-[var(--text-primary)]">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
};

export default Breadcrumb;
