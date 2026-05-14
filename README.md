# wyatt log

A low-fi static blog. White background, black text, markdown posts, no build step.

## adding a post

1. Create `posts/YYYY-MM-DD-slug.md`:

   ```markdown
   ---
   title: a short title
   date: 2026-05-13
   tags: lessons, infra
   ---

   Post body in markdown.
   ```

2. Add the slug (no `.md`) to `posts/manifest.json`:

   ```json
   { "posts": ["2026-05-13-slug", "..."] }
   ```

3. Reload. Newest date sorts first automatically.

## running locally

Browsers block `fetch()` on `file://`, so serve the folder:

```
cd wyatt-blog
python3 -m http.server 8000
# open http://localhost:8000/
```

## deploying

Push the folder to a GitHub repo and enable Pages on the branch (or
drop it on Netlify / Vercel / Cloudflare Pages). The `.nojekyll` file
keeps GH Pages from doing anything clever with the markdown files.

## structure

```
wyatt-blog/
  index.html      feed of posts, newest first
  about.html      one-pager about you / the project
  style.css       all styling
  blog.js         loads manifest, fetches posts, renders, filters by tag
  posts/
    manifest.json list of post slugs
    *.md          one file per post, with frontmatter
```
