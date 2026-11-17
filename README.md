# Life Centre app: prototype

A clickable preview of the Life Centre app design. All names, times and numbers on screen are sample data.
Open `index.html` (or the published site). Pick a screen from the list at the top, or tap through the app itself.
Pages: launch pop-up, Home, Day plan, Announcements, Giving, Watch, Contact, Facilities Booking Request, stories.
`support.js` is the runtime that draws the prototype pages. The real app will be built with standard web code.

## The app

The real app is in `app/` and is published to GitHub Pages at the root of **https://app.lifecentre.sg/** by the workflow in
`.github/workflows/pages.yml` (`node scripts/build-site.mjs` builds the folder it publishes; `/app/` redirects to the root).
Try it locally with `npm run serve` then http://localhost:5173/app/?emulator. The move to this address is in APP-DOMAIN-SWITCH.md.
The prototype pages above are no longer published.
