# Brauzer testləri (headless Chromium + axe-core)

Real Supabase tələb etmir: `mock.mjs` PostgREST/Auth/Storage cavablarını təqlid edən saxta serverdir
(yalnız sınaq üçün, heç vaxt production-da işlətməyin).

    # 1) saxta Supabase ünvanı ilə qurun və işə salın (layihə qovluğunda)
    NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test npm run build
    node tests/browser/mock.mjs &
    NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=test npx next start -p 3070 &

    # 2) testləri mərhələ-mərhələ işlədin (tests/browser qovluğunda: npm install)
    cd tests/browser && npm install
    STAGE=layout   node run.mjs   # 4 ekran ölçüsündə üfüqi scroll, h1, alt
    STAGE=shots    node run.mjs   # ekran görüntüləri -> out/
    STAGE=interact node run.mjs   # menyu, auth, kitablar, sınaq, çat, kabinet
    STAGE=axe      node run.mjs   # əlçatanlıq (WCAG 2.1 A/AA)

Nəticələr `res_<STAGE>.json` faylına yazılır. `mkdir out` əvvəlcədən yaradın.
