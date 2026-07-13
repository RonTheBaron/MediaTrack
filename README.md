# Reel Log — Personal Media Tracker

A private, single-user-per-account movie & TV watch tracker. Search TMDb,
add titles with one click, and track your own rating, status, notes, tags,
rewatches, and favorites — all synced to your own Firebase account.

Pure HTML/CSS/JS, no build step, no framework. Organized into small,
single-responsibility modules (see **Project structure** below).

---

## 1. Get it running (5–10 minutes)

### A. Create a Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. In the project, go to **Build → Authentication → Get started**, then enable the
   **Email/Password** sign-in provider.
3. Go to **Build → Firestore Database → Create database**. Start in
   **production mode** (the security rules below lock it down properly).
4. Go to **Project settings → General → Your apps**, click the **Web** icon
   (`</>`) to register a new web app, and copy the `firebaseConfig` object it
   gives you.

### B. Get a TMDb API key

1. Create a free account at [themoviedb.org](https://www.themoviedb.org/).
2. Go to **Settings → API** and request a free **Developer** API key.
3. Copy the **API Key (v3 auth)** value (not the v4 Read Access Token).

### C. Fill in your config

Open `js/config.js` and paste in both:

```js
export const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};

export const TMDB_API_KEY = "...";
```

### D. Lock down Firestore

In the Firebase console, go to **Firestore Database → Rules** and replace
the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/media/{itemId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

This ensures every user can only ever read or write documents inside their
own `users/{their-uid}/media/` collection — there is no way for one account
to see another's library, enforced at the database level (not just in the
UI).

### E. Run it

This app has no build step — it's static files. Any static file server
works, e.g. from the project folder:

```bash
npx serve .
# or
python3 -m http.server 8080
```

Then open the printed local URL. **Note:** opening `index.html` directly
via `file://` will *not* work, because the ES module imports and Firebase
SDK require a real HTTP origin. Also fine to deploy to Firebase Hosting,
Netlify, Vercel, GitHub Pages, etc.

---

## 2. Project structure

```
media-tracker/
├── index.html            Login / sign up
├── library.html           Your library: search, sort, filter, add titles
├── details.html            Full metadata + your personal tracking fields
├── stats.html               Statistics dashboard
├── css/
│   ├── base.css              Design tokens, reset, typography
│   ├── components.css        Navbar, buttons, forms, cards, modal, toasts
│   └── pages.css              Page-specific layout (login/library/details/stats)
├── js/
│   ├── config.js              ← YOU EDIT THIS (Firebase + TMDb keys)
│   ├── firebase-init.js       Initializes the Firebase app/auth/db singletons
│   ├── auth.js                Sign up / log in / log out / auth guard
│   ├── tmdb.js                 TMDb search + full-detail fetching
│   ├── firestore.js             All reads/writes to the user's library
│   ├── toast.js                  Toast notification component
│   ├── utils.js                   Formatting, debounce, lazy-load helpers
│   ├── nav.js                      Shared navbar
│   ├── login.js                     Controller for index.html
│   ├── library.js                    Controller for library.html
│   ├── details.js                     Controller for details.html
│   └── stats.js                        Controller for stats.html
└── README.md
```

Each page is a real, separate HTML document (not a single-page app) — this
keeps each controller small and focused, and means the browser's back
button, refresh, and bookmarks all just work.

---

## 3. How data is stored

Each library entry lives at `users/{uid}/media/{mediaType}_{tmdbId}` and
looks like:

```json
{
  "tmdb": {
    "tmdbId": 27205, "mediaType": "movie", "title": "Inception",
    "originalTitle": "Inception", "overview": "...",
    "posterPath": "/...", "backdropPath": "/...",
    "genres": ["Action", "Science Fiction"],
    "releaseDate": "2010-07-15", "runtime": 148,
    "voteAverage": 8.4, "voteCount": 35000, "language": "en",
    "productionCompanies": ["Warner Bros. Pictures", "Legendary Pictures"],
    "cast": [{ "name": "...", "character": "...", "profilePath": "..." }],
    "status": "Released", "numberOfSeasons": null, "numberOfEpisodes": null
  },
  "user": {
    "myRating": 9.5, "watchStatus": "completed", "dateWatched": "2024-03-02",
    "favorite": true, "rewatchCount": 2, "notes": "...", "tags": ["mind-bender"]
  },
  "dateAdded": "<server timestamp>",
  "dateUpdated": "<server timestamp>"
}
```

The `tmdb` object is always fully overwritten from TMDb — the UI never lets
you edit it. The `user` object is the only thing the app writes to based on
your input.

---

## 4. Notes on a few implementation choices

- **Search vs. add-to-library search** are two different things: the
  toolbar search on the Library page filters *your own* saved titles;
  the search inside the "+ Add Title" modal queries TMDb live.
- **Infinite scroll** is implemented client-side: your whole library loads
  once (fast at personal scale), then the grid reveals it in pages of 24 as
  you scroll, via `IntersectionObserver`.
- **Total watch time** on the Statistics page is clearly an *estimate*: for
  movies it uses the TMDb runtime; for TV shows it multiplies average
  episode runtime by episode count; both are multiplied by `1 + rewatchCount`
  for anything you've marked as started (not "Plan to Watch").
- **Import/Export** produces/consumes the same JSON shape shown above, so
  you can back up your library or move it between Firebase projects.
