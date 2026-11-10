export default function CharCount({ value, max, min = 0 }) {
  const n = value.length;
  const bad = n > max || (n > 0 && n < min);
  return <span className={bad ? 'text-danger' : 'text-muted'}>{n}/{max}</span>;
}
