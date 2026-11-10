// Admin cədvəlləri: dar ekranda cədvəl kartın daxilində üfüqi sürüşür (səhifə özü sürüşmür).
export function Table({ head, children, label }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm" aria-label={label}>
        <thead className="border-b border-line bg-canvas text-xs font-semibold text-muted">
          <tr>{head.map((h) => <th key={h} scope="col" className="whitespace-nowrap px-4 py-3">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className = '' }) => <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
