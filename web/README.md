# RAJGAR Ludo – PWA (v2.0)

Ludo · Snakes & Ladders · Carrom — offline, installable, with coins, shop, festival codes and RAJGAR Premium.

## Files
| File | Purpose |
|---|---|
| `index.html` | Home screen: games, Premium, daily bonus, Shop, Codes, Stats, Settings, Profile |
| `ludo.html` | Ludo – Classic & Quick mode, 2–4 players, vs Computer / pass & play, Lucky Six |
| `snakes.html` | Snakes & Ladders – 2–4 players, exact-100 bounce rule option |
| `carrom.html` | Carrom – physics, vs Computer (Easy/Medium/Hard) or 2 players |
| `shared.js` | Coins, shop catalogue, codes, Premium + Google Play Billing, dice skins, sounds |
| `shared.css` | Themes (Emerald, Royal Night, Sandalwood, Holi, Diwali), dice skins, UI |
| `sw.js` | Offline cache – **bump `VERSION` every time you change any file** |
| `manifest.webmanifest`, `icons/` | Install name, icons, store screenshot, home-screen shortcuts |
| `privacy.html` | Privacy policy (use its URL in Play Console) |
| `start.bat` | Run on your Windows PC for testing |

## 1. Test on your PC
Double-click **start.bat**, or in a terminal inside this folder:
```
npx --yes http-server . -p 8080 -c-1
```
Open http://localhost:8080 in Chrome. Press F12 → Application → Manifest to confirm it is installable.

## 2. Put it live (free HTTPS)
1. https://app.netlify.com/drop → drag this whole folder → you get `https://<name>.netlify.app`.
2. Own domain: Netlify → Domain management → add `ludo.gara.co.in`; at your DNS add
   `CNAME  ludo  <name>.netlify.app`.
3. On Android Chrome open the link → **Install** (Settings screen) or menu → *Add to Home screen*.

## 3. Updating later
Edit files → change `VERSION` in `sw.js` (e.g. `rajgar-ludo-v2.0.1`) → drag the folder to Netlify again.

## 4. Codes (change them in `shared.js` → `CODES`)
| Code | Gives |
|---|---|
| `HOLI` | Holi dice + Holi theme + 100 coins |
| `DIWALI` | Diwali dice + Diwali theme + 100 coins |
| `RAJGAR500` | 500 coins |
| `GARAVIP` | All premium items permanently + 5 Lucky Six |
Each code works once per phone. Codes are hidden as hashes, not secure – never give real-money value through codes.
To add a code: run `node -e "..."` with the `hash()` function from shared.js on the UPPERCASE code and add the result to `CODES`.

## 5. Premium & Google Play Billing
* Every new user gets **90 days Premium free** (counted on the phone from first launch).
* Shown prices (`shared.js` → `PREMIUM`): ~~₹9~~ **₹4/year** and ~~₹39~~ **₹19 lifetime** until **31 Mar 2028**, then ₹9 / ₹39.
* Billing only works in the **Google Play (TWA) version**. On the website the buttons say "Buy in the Google Play app".
* **Buying stays OFF until `verifyUrl` is set** in `shared.js` – Google refunds any purchase a server has not acknowledged within 3 days. The server is in the separate `rajgar-ludo-server` folder (see its README).

### Play Console prices – set the REAL price, not a "discount offer"
Google's documentation for the web-app billing bridge (Digital Goods API) covers only the product's own price; it does not
document Play subscription offers, so don't rely on an offer being applied at checkout. So:
1. Monetize → **Subscriptions** → `rajgar_premium_yearly` → base plan **₹4 / 1 year**, auto-renewing. No offer.
2. Monetize → **In-app products** → `rajgar_premium_lifetime` → **₹19**.
3. On **1 Apr 2028** change them to **₹9** and **₹39**. Existing yearly subscribers keep ₹4 unless you migrate them
   (Play's "legacy price" option) – keep them on ₹4, it's the honest choice. The app stops showing the strike-through automatically after 31 Mar 2028.
4. Add your Gmail as a **licence tester** and test a purchase on the internal-testing track before release.

### Packaging for Play
1. Deploy the website (section 2), then https://www.pwabuilder.com → Android → enable **Play Billing** → download the .aab.
2. Put the generated `assetlinks.json` at `.well-known/assetlinks.json` in this folder and redeploy.
3. Upload the .aab in Play Console; privacy policy URL = `https://<your-domain>/privacy.html`.
