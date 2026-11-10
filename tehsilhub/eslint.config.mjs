import next from 'eslint-config-next/core-web-vitals';

export default [
  ...next,
  {
    rules: {
      // Məlumat yükləmə və URL-dən ilkin vəziyyət oxuma effektlərdə qəsdən edilir.
      'react-hooks/set-state-in-effect': 'warn',
      // Elan şəkilləri dinamik Supabase ünvanlarından gəlir; <img> ölçü/aspekt qutusu ilə istifadə olunur.
      '@next/next/no-img-element': 'off'
    }
  },
  { ignores: ['.next/**', 'node_modules/**', 'tests/**'] }
];
