# kanyeceejaya.github.io

Personal site of Akbr Kanyesigye: <https://kanyeceejaya.github.io/>

Plain HTML, CSS and a little JavaScript, served by GitHub Pages. No framework and no build step for the pages. Google Analytics (G-CWJ7QV586G) is in the head of every page, including notes/template.html.

## What lives where

- `index.html` is the home page: intro, now, a few featured projects, the two latest notes, experience, papers, recognition, education, toolkit, beyond work and contact, plus the story pop-ups (`dialog.modal`).
- `projects/index.html` lists every project, with the group-by switch. It is the one place to edit projects.
- `notes/` is the blog. Each post is a plain HTML file, listed in `notes/index.html`.
- `404.html` is served by GitHub Pages for any missing path, so every link in it is absolute.
- `css/site.css` holds the design tokens for light and dark, the type scale and every component.
- `js/site.js` runs the theme switch, menu drawer, section rail and phone section pill, years strip, the group-by switch, project rows and their pop-up, the compact and summary views for roles (with only the four most recent shown at first), compact and full views for papers, hearts and comments on notes, and the larger view for screenshots in notes. An old home-page link to a project that is not featured goes on to the projects page.
- `js/extras.js` adds the console greeting, `help()` and the `akbr.*` console commands, and the hidden extras. It loads `js/arcade.js` and `js/desk.js` only when someone finds them.
- `js/arcade.js` is the "Take a break" picker. Each game lives in `js/games/` and loads only when chosen: `boda.js` (Boda Dispatch), `rolex.js` (Rolex Rush) and `route.js` (Enumerator's Route, whose eight parishes are the `LEVELS` at the top of the file). Scores are kept in the visitor's browser only.
- `js/games/letters.js` is the letter blaster: a small ship that shoots the page's own letters, and puts them back when you stop. For now only the 404 page starts it, from its `[data-blast]` button.
- `images/` holds the portrait, project screenshots, row thumbnails (`images/thumbs/`), desk prints (`images/desk/`), screenshots for notes (`images/notes/`, with square thumbnails for the home page in `images/notes/thumbs/`), icons and the social card (`images/og-card.jpg`).
- `docs/` holds the current CV and the slides linked from notes. Old CVs stay local and are listed in `.gitignore`.

## Editing content

- **A project** is an `article.sheet` in `projects/index.html`. Keep `data-audience`, `data-year` and `data-kind` filled in for the group-by switch. Add `data-mono` for a coloured tile when there is no screenshot, and `data-thumb` on its screenshot for a small row thumbnail. Add `data-featured` to show it on the home page too; the build script copies it across.
- **A note:** copy `notes/template.html`, set the title, date, description and the `data-heart` and `data-note` values in its reactions block, then add it to the list in `notes/index.html`. The two newest notes appear on the home page, each with a small square picture from `images/notes/thumbs/<note file name>.jpg` (240 by 240), or its share image if there is none. For a screenshot, use `<figure class="wide">` with the image inside `<a class="zoom" href="...">` so it opens larger; `figure class="pair"` sets two side by side (`pair even` for equal halves), `figure class="strip"` sets three in a row, and `div class="gallery"` holds several figures with their own captions.
- **A photo on the desk:** add a line to `PRINTS` at the top of `js/desk.js`.
- **Any `[data-modal="id"]` button** opens the `dialog` with that id, and any `[data-play]` button opens the games.

After changing content, refresh the machine-readable files:

```
python scripts/build-meta.py
```

That copies the featured projects and the two latest notes onto the home page, lists every note in the structured data of `notes/index.html`, and rewrites `llms.txt`, `llms-full.txt`, `sitemap.xml` and `notes/feed.xml`. It needs BeautifulSoup (`pip install beautifulsoup4`).

## Machine-readable files

- `llms.txt` and `llms-full.txt`: a short and a full plain-text version of the site for language models.
- `sitemap.xml` and `robots.txt` for search engines, `notes/feed.xml` as an Atom feed of the notes.
- `humans.txt`, and structured data (JSON-LD) in the head of every page.

## Preview locally

Run any static server from the repository root, for example `python -m http.server 8000`, and open <http://localhost:8000/>.

Type: Fraunces for display and Atkinson Hyperlegible Next for text, both from Google Fonts.

GNU Terry Pratchett.
