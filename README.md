# Ironlog — Workout, Cardio & Bodyweight Tracker

A personal, Strava-style tracker for gym sessions, running, and daily
bodyweight — built as a plain HTML/CSS/JS site (no build step, no
framework) so it can be hosted for free on GitHub Pages and installed
on your iPhone home screen like an app.

Your data is stored in **Firebase** (free tier), so it syncs between
your phone and laptop and survives Safari clearing its cache.

---

## 1. Create your Firebase project (~5 minutes)

1. Go to **https://console.firebase.google.com** and sign in with any
   Google account.
2. Click **Add project** → name it anything (e.g. `ironlog`) → you can
   disable Google Analytics for this project, it's not needed → **Create project**.
3. In the left sidebar, click **Build → Authentication** → **Get started**.
   - Click the **Email/Password** provider → toggle it **Enable** → **Save**.
4. In the left sidebar, click **Build → Firestore Database** → **Create database**.
   - Choose any location close to you → start in **production mode** → **Create**.
5. Once created, go to the **Rules** tab of Firestore and replace the
   default rules with the contents of `firestore.rules` from this repo
   (locks the database so only you, signed in, can read/write your own
   data). Click **Publish**.
6. Go to **Project settings** (gear icon, top left) → scroll to
   **Your apps** → click the **</>** (Web) icon → register an app
   (nickname can be anything, no need to set up Hosting) → it will show
   a `firebaseConfig` object like:

   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "ironlog-xxxxx.firebaseapp.com",
     projectId: "ironlog-xxxxx",
     storageBucket: "ironlog-xxxxx.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

7. Copy those values into **`js/firebase-config.js`** in this project,
   replacing the placeholder strings.

That's it for Firebase — there's nothing else to configure.

---

## 2. Push to GitHub & turn on Pages

1. Create a new **public** GitHub repo (e.g. `ironlog`).
2. Upload every file from this folder, keeping the same structure
   (`index.html`, `css/`, `js/`, `icons/`, etc. all in the repo root).
3. In the repo, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to `Deploy from a branch`,
   branch `main`, folder `/ (root)` → **Save**.
5. Wait ~1 minute, then refresh — GitHub will show your live URL, like:
   `https://yourusername.github.io/ironlog/`

---

## 3. Create your account & install on iPhone

1. Open your GitHub Pages URL in **Safari** on your iPhone.
2. You'll land on the sign-in screen → tap **Create account** → enter
   any email + a password (this is just your personal login, it
   doesn't need to be verified — it's only used to keep your Firestore
   data private to you).
3. Tap the **Share** button in Safari → **Add to Home Screen** → **Add**.
4. Open it from your home screen — it now runs full-screen, no Safari
   address bar, like a real app.

Do the same in any desktop browser pointed at the same URL, sign in
with the same email/password, and your data will match on both.

---

## 4. Using the app

- **Home** — today's quick-log buttons, muscle recovery status, this
  week's stats, recent activity.
- **Train** — log a strength session: pick the muscles you're
  training, add exercises from your library, log weight × reps per
  set. Shows your previous performance on each exercise as you add it.
- **Cardio** — log running/cycling/etc. with duration + distance;
  pace/speed is calculated automatically.
- **Calendar** — tap any day to see (and delete) what you logged.
- **Stats** — cardio distance per week, your muscle-group training
  split (pie chart), per-exercise weight progression, and your
  personal records.
- **⚙ icon** (top right of Home) → **Exercises** — add, rename, or
  delete exercises in your library at any time. New ones immediately
  show up in the Train page picker.
- **Body weight** is logged from the **+ Log weight** button on Home —
  one entry per day, with a trend chart.

---

## 5. Things you can tweak yourself later

- **Exercise list**: edit directly from the Exercises page in the app
  (no code needed), or edit the starting list in `js/exercises-data.js`
  before your first sign-in (it only seeds once, on account creation).
- **Muscle recovery days**: open `js/exercises-data.js` and change the
  `RECOVERY_DAYS` object — currently: Chest/Shoulder/Bicep/Tricep = 2
  days, Back/Legs = 3 days, Forearm/Abs = 1 day.
- **App icon**: replace `icons/icon-192.png` and `icons/icon-512.png`
  with your own (same filenames, square images).
- **Colors/fonts**: all in `css/style.css` at the top, under `:root`.

---

## 6. Notes

- This site needs an internet connection to sign in and to read/write
  your data the first time each page loads. Once a page has loaded,
  Firestore keeps a local cache of data you've already seen, so brief
  signal drops mid-gym won't lose anything — but a fresh app launch
  with zero connectivity won't load.
- Firebase's free "Spark" plan is far more than enough for one person
  logging daily for years — there's no cost here.
- If you ever want to wipe everything and start over, delete the
  Firestore data for your `users/{your-uid}` document from the Firebase
  console, or just delete and recreate the project.
