import React from 'react';

export default function Pagination({
  currentPage,
  totalItems,
  pageSize = 6,
  onPageChange,
}) {
  const totalPages = Math.ceil(totalItems / pageSize);

  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="pagination-container" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '12px',
      marginTop: '24px',
      paddingTop: '16px',
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
        Показано <strong>{startItem}–{endItem}</strong> из <strong>{totalItems}</strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{ padding: '6px 12px', fontSize: '13px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
        >
          ← Назад
        </button>

        {getPageNumbers().map((p, idx) =>
          p === '...' ? (
            <span key={`dots-${idx}`} style={{ padding: '0 6px', color: 'var(--text-muted)' }}>
              ...
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                borderRadius: '6px',
                border: '1px solid',
                borderColor: currentPage === p ? 'var(--accent)' : 'var(--border)',
                background: currentPage === p ? 'var(--accent)' : 'var(--card-bg)',
                color: currentPage === p ? '#fff' : 'var(--text)',
                fontWeight: currentPage === p ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          )
        )}

        <button
          type="button"
          className="btn-secondary"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{ padding: '6px 12px', fontSize: '13px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
        >
          Вперед →
        </button>
      </div>
    </div>
  );
}
