import { safeUrl } from '../../lib/safe';

// Mətni HTML kimi YOX, sadə mətn kimi göstərir (React avtomatik escape edir).
// Yalnız https:// ünvanları keçid olur; nofollow/ugc ilə, yeni pəncərədə. javascript:, data: və http: keçid olmur.
const URL_RE = /(https:\/\/[^\s<>"']+)/g;

export default function Linkify({ text, className = '' }) {
  const parts = String(text || '').split(URL_RE);
  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part;
        const trail = (part.match(/[.,;:!?)\]]+$/) || [''])[0];
        const clean = trail ? part.slice(0, -trail.length) : part;
        const href = safeUrl(clean);
        if (!href) return part;
        return (
          <span key={i}>
            <a href={href} target="_blank" rel="nofollow ugc noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary-hover">{clean}</a>
            {trail}
          </span>
        );
      })}
    </div>
  );
}
