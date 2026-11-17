# Moving the app to app.lifecentre.sg: switch-over checklist

The new app is published to GitHub Pages by a workflow (`.github/workflows/pages.yml`, which runs `scripts/build-site.mjs`).
It puts the app at the **root** of the site, so it works at `https://lifecentresg.github.io/lifecentre-app/` (test) and at
`https://app.lifecentre.sg/` (final). `/app/` redirects to the root. All paths in the app are relative.

What is already true (checked 17 Nov 2026, nothing changed):
- DNS: `app.lifecentre.sg` is a CNAME to `lifecentresg.github.io`, the same host the new repo is served from, so **no DNS change is needed, now or at rollback**.
- Firebase sign-in lists `app.lifecentre.sg`, `lifecentresg.github.io` and `icathia.com` as authorized domains.
- The old app on `app.lifecentre.sg` also has `sw.js` and a manifest at the root with the same app id (`/`), so installed copies update in place, in both directions.

## A. Get the new repo ready (nothing public changes)

1. Rename `LifeCentreSG/lifecentre-app` to `lifecentre-app-old`. Its Pages site and custom domain stay as they are.
2. Transfer `Icathia-com/lifecentre-app-prototype` to `LifeCentreSG` and rename it `lifecentre-app`. Then on this computer:
   `git remote set-url origin https://github.com/LifeCentreSG/lifecentre-app.git`
3. Merge the `app-domain` branch to `main`.
4. In the new repo: Settings > Pages > Source = **GitHub Actions**. Run the "Publish the app" workflow (it also runs on every push to `main`).
5. Deploy the Cloudflare Worker with the new allowed origins (`cd cloudflare/uploads`, then `npx wrangler deploy`). Needed before uploads work from the test address.
6. Test at `https://lifecentresg.github.io/lifecentre-app/` in a private window (browsers remember the old redirect to app.lifecentre.sg): Home, tabs, `/app/#/events` redirects, daily verse, profile and Share, sign in, a booking, a story or pop-up picture upload.

## B. Switch (a few minutes of downtime between 7 and 8)

7. Old repo `lifecentre-app-old`: Settings > Pages > clear the custom domain (and untick Enforce HTTPS if it asks).
8. Merge the `custom-domain` branch to `main` (it adds only the `CNAME` file) and let the workflow run. Then in the new repo: Settings > Pages > Custom domain = `app.lifecentre.sg`, tick **Enforce HTTPS** once it is offered (GitHub issues the certificate; this can take a few minutes up to about an hour).
9. Check `https://app.lifecentre.sg/` opens Home, and `https://app.lifecentre.sg/app/` goes to it.
10. Apps Script, so booking emails link to the new address: push `Webapp.js` (`DEFAULT_BOOKING_APP_URL`). In the editor, check the Script Properties `BOOKING_APP_URL`, `PUBLIC_APP_URL`, `STAFF_APP_URL` and `ADMIN_APP_URL`: if one is set to an old address it overrides the code, so change or delete it.
11. Once everything works: remove `https://icathia.com` from `ALLOWED_ORIGINS` in `cloudflare/uploads/wrangler.toml` and deploy the Worker again.

## C. Roll back (the old app is back on app.lifecentre.sg)

1. New repo: Settings > Pages > clear the custom domain. Revert the `CNAME` commit on `main` so the workflow does not claim it again.
2. `lifecentre-app-old`: Settings > Pages > Custom domain = `app.lifecentre.sg`, tick Enforce HTTPS.
3. Booking emails: set the Script Property `BOOKING_APP_URL` to the link the old app needs (takes effect at once, no push or new version).
4. Nothing else changes: DNS, Firebase domains and the Worker's allowed origins all still work for both apps.

How long: the GitHub settings take a minute each. The part GitHub does not promise is the HTTPS certificate when a domain moves between repos: usually minutes, sometimes up to an hour, in either direction.
Phones that opened the new app keep its service worker until they next open the site; it asks the network first, and the old app's own `sw.js` replaces it on that visit.
