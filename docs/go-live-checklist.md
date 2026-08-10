# Go-Live Checklist (Custom Domains)

One-page launch checklist for BeFluencer admin + public reports.

Temporary live host (keep as rollback):
`https://befluencer-reports.vercel.app`

Target hosts:

- Admin: `https://app.befluencer.co`
- Public reports/lists: `https://reports.befluencer.co`

Do **not** change apex `befluencer.co` / `www` here (future corporate site).

---

## Steps

1. **Vercel → Domains**  
   Add `app.befluencer.co`

2. **Vercel → Domains**  
   Add `reports.befluencer.co`

3. **Copy exact DNS records**  
   Use only the records Vercel displays for those two hostnames (usually CNAME).

4. **cPanel → Zone Editor**  
   Add/edit **only** the records Vercel requires for `app` and `reports`.

   cPanel notes:
   - Use **Zone Editor**
   - Do **not** modify apex `befluencer.co`
   - Do **not** delete mail / MX records
   - Do not invent A/CNAME values — paste what Vercel shows

5. **Wait** until Vercel shows **Valid Configuration** for both domains.

6. **Vercel → Environment Variables (Production)**  
   Set:

   ```bash
   APP_URL=https://app.befluencer.co
   PUBLIC_REPORT_URL=https://reports.befluencer.co
   ```

7. **Redeploy** the Production deployment.

8. **Supabase → Authentication**  
   - Site URL: `https://app.befluencer.co`
   - Redirect allowlist:
     - `http://localhost:3000/**`
     - `https://befluencer-reports.vercel.app/**`
     - `https://app.befluencer.co/**`

9. **Smoke tests**

   Local validation (no secrets printed):

   ```bash
   npm run domain:check -- --production
   npm run domain:smoke -- --app https://app.befluencer.co --reports https://reports.befluencer.co
   ```

   Manual:
   - login works on app
   - new report share starts with `https://reports.befluencer.co/r/`
   - new list share starts with `https://reports.befluencer.co/lists/`
   - fake tokens show unavailable (not login)
   - revoke still blocks immediately

10. **Keep rollback**  
    Leave `befluencer-reports.vercel.app` attached. If needed, set both env vars back to that origin and redeploy.

---

## Temporary vs final env

| Phase | APP_URL | PUBLIC_REPORT_URL |
|-------|---------|-------------------|
| Before DNS | `https://befluencer-reports.vercel.app` | same |
| After DNS Valid | `https://app.befluencer.co` | `https://reports.befluencer.co` |

Do not force custom domains in code before DNS is Valid.

Full runbook: [production-domain-launch.md](./production-domain-launch.md)
