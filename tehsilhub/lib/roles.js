// Hesab tipləri. Dəyərlər verilənlər bazasındakı CHECK məhdudiyyəti ilə eynidir (06_roles_and_forum.sql).
// 'admin' bura DAXİL DEYİL: admin hüququ yalnız serverdə (admin_users cədvəli) verilir.
export const ACCOUNT_TYPES = [
  { value: 'teacher', label: 'Müəllim', icon: 'teacher', desc: 'Dərs deyirəm, təcrübə və resurs paylaşıram.' },
  { value: 'student', label: 'Şagird', icon: 'school', desc: 'Məktəbdə oxuyuram, imtahana hazırlaşıram.' },
  { value: 'university_student', label: 'Tələbə', icon: 'university', desc: 'Universitetdə və ya magistraturada oxuyuram.' }
];

const BY_VALUE = new Map(ACCOUNT_TYPES.map((t) => [t.value, t]));

export const isAccountType = (v) => BY_VALUE.has(v);
export const accountLabel = (v) => BY_VALUE.get(v)?.label || '';
export const accountIcon = (v) => BY_VALUE.get(v)?.icon || 'user';
