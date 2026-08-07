# Corporate Website Plan (Future)

Separate Next.js project and Vercel deployment for `https://befluencer.co`.
**Not implemented in this repository.**

## Proposed sitemap

### Turkish

- `/`
- `/tr/hizmetler`
- `/tr/muzik-pazarlama`
- `/tr/markalar-ajanslar`
- `/tr/creator-marketing`
- `/tr/calismalar`
- `/tr/calismalar/[slug]`
- `/tr/hakkimizda`
- `/tr/iletisim`

### English

- `/en`
- `/en/services`
- `/en/music-marketing`
- `/en/brands-agencies`
- `/en/creator-marketing`
- `/en/work`
- `/en/work/[slug]`
- `/en/about`
- `/en/contact`

(Exact English slugs may be refined during design.)

## Content modules

- Hero
- Featured work
- Artists / brands worked with
- Service pages
- Case studies
- Campaign metrics (public-safe highlights only)
- Testimonials
- Team
- Contact / lead form
- Footer and social links

## Content-management options

1. **Repository content** — MDX / typed content modules (fast start)  
2. **Supabase-backed content** — shared org DB with strict public-only tables  
3. **Headless CMS** — if editorial workflow needs grow  

## Boundaries

- No internal service-role keys in the corporate project  
- No admin application routes or report snapshot access  
- Links to `app.befluencer.co` only for staff login if needed  
- Public report URLs stay on `reports.befluencer.co`  

## Delivery sequence (suggested)

1. Bootstrap separate repo + design system  
2. Turkish home + services  
3. Case studies / clients  
4. English parity  
5. Preview deploy → DNS cutover after approval  
