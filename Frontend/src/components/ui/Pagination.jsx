import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, pages, total, onChange, label = "results" }) {
  if (!total) return null;
  return (
    <div className="pagination">
      <span className="pagination__info">
        Page {page} of {pages} · {total} {label}
      </span>
      <div className="pagination__buttons">
        <button className="btn btn--secondary btn--sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft size={16} /> Previous
        </button>
        <button className="btn btn--secondary btn--sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
