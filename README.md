# nkocovic.github.io

Nikola Kočović's personal website. Plain HTML and CSS, with no build step.

| File | What it is |
|---|---|
| `index.html` | Home page, English |
| `sr/index.html` | Home page, Serbian. Keep it in step with the English one. |
| `style.css` | All styling: colours, fonts and animations are set at the top |
| `site.js` | Scroll-in animations, "Show more" buttons, expandable rows, latest posts on the home page |
| `sushi.js` | The sushi conveyor toy in the home page header (drag, throw, tap to hop, tap the belt for turbo) |
| `blog/` | The blog (the Serbian blog pages live in `sr/blog/`) |
| `blog/tierlists.json` | The tier lists shown in the Tier lists section of the blog |
| `fonts/` | The two fonts (Inter and Newsreader), served from the site itself |
| `images/nikola.jpg` | The portrait on the home page |
| `handouts/` | Handout PDFs |
| `projects/` | Project PDFs (e.g. the SYPT Ring Fountain presentation) |
| `404.html` | The page shown for a link that doesn't exist |
| `og.png` | The picture shown when a link to the site is shared |
| `sitemap.xml`, `robots.txt` | Tell search engines which pages exist |
| `cv.pdf`, `cv-sr.pdf` | CV, English and Serbian |

## Writing a blog post

1. Write the post in Markdown and save it in `blog/posts/`, e.g. `blog/posts/first-post.md`.
   The file name, without `.md`, is the post's *slug*: use lowercase letters, digits and dashes only.
2. Add an entry to `blog/posts.json` (order doesn't matter; newest is shown first):

   ```json
   [
     {
       "slug": "first-post",
       "title": "My first post",
       "date": "2026-11-10",
       "lang": "en",
       "summary": "One line shown under the title in the list."
     }
   ]
   ```

   Use `"lang": "sr"` for a post written in Serbian. Both the English and the Serbian blog list every
   post, with a small EN or SR tag on posts written in the other language.
3. Maths works: `$E = mc^2$` inline, and `$$ ... $$` on its own lines for a displayed equation.
   Write `\$` for a literal dollar sign.

4. Photos: put the file in `blog/images/` and write `![Description](/blog/images/photo.jpg "Caption")`.
   The caption in quotes is optional and appears under the photo.

Don't put the title at the top of the Markdown file: it comes from `posts.json`.

## Editing a tier list

All tier lists live in `blog/tierlists.json`. Each list gets its own section on the blog page, in
English and in Serbian (the first one is at `blog/#tierlists`). A list looks like this:

```json
{
  "id": "belgrade-restaurants",
  "label": { "en": "Restaurants", "sr": "Restorani" },
  "title": { "en": "Best restaurants in Belgrade", "sr": "Najbolji restorani u Beogradu" },
  "updated": "2026-11-10",
  "maps": "restoran Beograd",
  "tiers": {
    "S": [
      "Just a name",
      { "name": "Another one", "note": "My take.", "try": "What to order.", "link": "https://..." }
    ],
    "A": [],
    "B": []
  }
}
```

- `label` is the small word in the left column; `title` is the line above the places.
- Tiers are drawn in the order S, A, B, C, D, E, F; leave out the ones you don't need.
- An item is just a name, or `{ "name", "note", "try", "link" }`: `note` is shown under the name,
  `try` as a "Try" line, and `link` makes the name a link.
- Any text can be plain, or `{ "en": ..., "sr": ... }` when it differs by language.
- `updated` and `note` (a line under the title) are optional.
- `"maps": "restoran Beograd"` adds a "Map ↗" link to every place: it searches Google Maps for the
  name plus those words. Give an item its own `"map": "..."` to search for something else.
- For a numbered list (1, 2, 3…) use `"ranked": [ ... ]` in place of `"tiers"`, items in order.
- To add another list, add another `{ ... }` block to the array, separated by a comma.

## After changing `style.css` or a `.js` file

Every page loads them with a version label, e.g. `style.css?v=20261112d`. Phones (Safari especially)
keep old copies for a while, so after editing either, change that label to today's date on **every
page**: `index.html`, `sr/index.html`, `blog/index.html`, `blog/post.html`, `sr/blog/index.html`,
`sr/blog/post.html` and `404.html`. A search-and-replace of the old label across the folder does it.

## Previewing locally

From this folder, run `python3 -m http.server` and open <http://localhost:8000>.
(The blog loads its posts with `fetch`, so opening the HTML files directly from disk won't show them.)
