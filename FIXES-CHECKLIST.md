# Coach Princeton Basketball — Pre-Ads Fix Checklist

**Site:** coachprincetonbasketball.com
**Last Updated:** 2026-02-21
**Goal:** Complete all fixes before launching Google Ads at $20-40/day

---

## DAY 1 — CRITICAL (Revenue-Blocking)

- [x] **Build /thank-you/ page** — Post-purchase page with order confirmation, next steps, and Google Ads purchase conversion pixel (`gtag('event', 'conversion', ...)`)
- [x] **Fix pricing button tracking** — Pricing section `<button onclick>` elements now fire `begin_checkout` gtag events (were invisible to the `a[href*="/checkout/"]` selector)
- [x] **Fix mobile navigation** — Added hamburger menu to About, Contact, and Privacy pages (were completely hidden on mobile)
- [x] **Fix book page bottom CTA** — Bottom CTA now links to `/checkout/?product=system` instead of bare `/checkout/` (was defaulting to $49 bundle)
- [x] **Fix VideoObject schema** — Changed `contentUrl` and `embedUrl` from YouTube channel URL to actual content page

---

## DAY 2 — HIGH PRIORITY (Conversion Optimization)

- [x] **Create og-image.jpg** — 1200x630px social sharing image (dark theme, gold accents, basketball court design)
- [x] **Create logo.png** — 512x512 logo for Organization schema / Google Knowledge Panel
- [ ] **Add Google Ads purchase conversion label** — Replace `'AW-11158472206/purchase'` on thank-you page with actual conversion label from Google Ads account (format: `AW-11158472206/XXXXX`)
- [x] **Fix Course schema name** — Changed from "Princeton Offense Mastery Blueprint" to "Princeton Offense System"
- [x] **Add email capture** — Exit-intent popup on homepage with Netlify Forms (fires on mouse exit desktop, 45s timer mobile)

---

## DAY 3 — MEDIUM PRIORITY (Trust & Engagement)

- [ ] **Build contact form** — Contact page has email/social links but no actual form (Netlify Forms is free and takes 5 min)
- [ ] **Add Content Security Policy header** — `netlify.toml` has basic security headers but no CSP (add to pass security audits)
- [ ] **Add HSTS header** — Force HTTPS at browser level with `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] **Fix email inconsistency** — Homepage footer uses `support@coachprincetonbasketball.com`, other pages use `coachdeforest@gmail.com` — pick one
- [ ] **Add testimonial photos** — Review section has names but no photos (photos increase trust 40%+)

---

## WEEK 1 — PRE-ADS OPTIMIZATION

- [ ] **Create dedicated landing page for ads** — Don't send paid traffic to homepage. Build a focused page: headline > problem > solution > social proof > CTA. No nav distractions.
- [ ] **Set up Google Ads conversion tracking** — Create actual conversion action in Google Ads, get the label, update thank-you page
- [ ] **Set up remarketing pixel** — Add Google Ads remarketing tag for visitors who don't buy (retarget for $5-10/day)
- [ ] **Add urgency elements** — Limited-time pricing, countdown timer, or seasonal offer (e.g., "Pre-Season Special")
- [ ] **Build post-purchase upsell flow** — Thank-you page or email upsell (e.g., 1-on-1 coaching call, camp registration, custom playbook)

---

## WEEK 2 — GROWTH INFRASTRUCTURE

- [ ] **Connect GitHub repo** — Run `gh auth login` and push to GitHub for version control and collaboration
- [ ] **Set up email automation** — Mailchimp/ConvertKit welcome sequence for new buyers and leads
- [ ] **Add FAQ schema to subpages** — Blog posts and book page could benefit from FAQ structured data
- [ ] **Optimize page speed** — Inline critical CSS, lazy-load below-fold images, preload hero fonts
- [ ] **Add A/B testing** — Test headline variations, CTA copy, pricing display (Google Optimize or simple JS)
- [ ] **Create blog content calendar** — SEO-driven posts targeting "Princeton Offense" long-tail keywords
- [ ] **Build affiliate/referral program** — Let satisfied coaches earn commission for referrals
- [ ] **Add live chat or chatbot** — Answer pre-purchase questions instantly (Crisp, Tawk.to = free)
- [ ] **Create video testimonials page** — Ask top customers for 30-second video reviews
- [ ] **Set up Google Search Console** — Submit sitemap, monitor search performance, fix crawl errors

---

## NOTES

- **Netlify deploy command:** `netlify deploy --prod --dir=.`
- **Site ID (production):** ef469341-8cde-437a-be68-a9fba72c47d6
- **Google Ads ID:** AW-11158472206
- **DNS:** Netlify DNS via GoDaddy nameservers (dns1-4.p02.nsone.net)
- **Payment:** Authorize.net via Accept.js + Netlify Functions
