/* wyatt log - tiny client-side blog renderer
 *
 * Workflow:
 *   1. Write a markdown file at posts/YYYY-MM-DD-slug.md with frontmatter.
 *   2. Add the slug to posts/manifest.json.
 *   3. Reload.
 *
 * Routing:
 *   /                -> index (post list)
 *   /#<slug>         -> single post view
 */

(async function () {
  const viewEl = document.getElementById('view');
  const introEl = document.getElementById('intro');
  const headerEl = document.querySelector('.site-header');

  // --- helpers ---------------------------------------------------------

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function parseFrontmatter(text) {
    const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!m) return { meta: {}, body: text };
    const meta = {};
    m[1].split('\n').forEach((line) => {
      const i = line.indexOf(':');
      if (i === -1) return;
      const key = line.slice(0, i).trim();
      let val = line.slice(i + 1).trim();
      if (val.startsWith('[') && val.endsWith(']')) {
        val = val.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
      } else if (key === 'tags') {
        val = val.split(',').map((s) => s.trim()).filter(Boolean);
      } else {
        val = val.replace(/^["']|["']$/g, '');
      }
      meta[key] = val;
    });
    return { meta, body: m[2] };
  }

  function dateFromSlug(slug) {
    const m = slug.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : '';
  }

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return `${d} ${MONTHS[m - 1]}, ${y}`;
  }

  const CAL_ICON = `<svg class="cal" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 11h18"/></svg>`;

  function excerpt(body, max = 180) {
    const para = body.split(/\n\n+/).find((p) => {
      const t = p.trim();
      return t && !t.startsWith('#') && !t.startsWith('>') && !t.startsWith('-') && !/^\d+\./.test(t);
    });
    if (!para) return '';
    const text = para.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                     .replace(/[`*_]/g, '')
                     .replace(/\s+/g, ' ')
                     .trim();
    return text.length > max ? text.slice(0, max).trim().replace(/[,.;:]$/, '') + '…' : text;
  }

  function readTime(body) {
    const words = body.trim().split(/\s+/).length;
    const min = Math.max(1, Math.round(words / 220));
    return `${min} min read`;
  }

  // --- fetch posts -----------------------------------------------------

  let manifest;
  try {
    const res = await fetch('posts/manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('manifest.json: ' + res.status);
    manifest = await res.json();
  } catch (err) {
    viewEl.innerHTML = `<div class="error">Couldn't load posts/manifest.json.<br>
      If you're opening this with file:// the browser blocks fetch — serve locally:
      <br><br><code>cd wyatt-blog &amp;&amp; python3 -m http.server 8000</code>
      <br><br>then open <code>http://localhost:8000/</code>.<br><br>(${escapeHtml(String(err))})</div>`;
    return;
  }

  const slugs = manifest.posts || [];
  if (!slugs.length) {
    viewEl.innerHTML = `<p class="loading">No posts yet. Add one in <code>posts/</code> and list it in <code>manifest.json</code>.</p>`;
    return;
  }

  const posts = await Promise.all(slugs.map(async (slug) => {
    try {
      const res = await fetch(`posts/${slug}.md`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(slug + ': ' + res.status);
      const text = await res.text();
      const { meta, body } = parseFrontmatter(text);
      return {
        slug,
        title: meta.title || slug,
        date: meta.date || dateFromSlug(slug),
        tags: Array.isArray(meta.tags) ? meta.tags : [],
        body,
        excerpt: excerpt(body),
        readTime: readTime(body),
        ok: true,
      };
    } catch (err) {
      return { slug, ok: false, error: String(err) };
    }
  }));

  posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (window.marked) {
    window.marked.setOptions({ gfm: true, breaks: false });
  }

  // --- views -----------------------------------------------------------

  function renderList() {
    if (headerEl) headerEl.hidden = false;
    introEl.hidden = false;

    const filtered = posts.filter((p) => p.ok);

    if (!filtered.length) {
      viewEl.innerHTML = `<p class="loading">No posts yet.</p>`;
      return;
    }

    const items = filtered.map((p) => {
      return `
        <li class="post-row">
          <a class="row-title" href="#${escapeHtml(p.slug)}">${escapeHtml(p.title)}</a>
          <div class="row-meta">
            ${CAL_ICON}
            <time datetime="${escapeHtml(p.date)}">${escapeHtml(formatDate(p.date))}</time>
            <span class="dot">&bull;</span>
            <span>${escapeHtml(p.readTime)}</span>
          </div>
          ${p.excerpt ? `<p class="row-excerpt">${escapeHtml(p.excerpt)}</p>` : ''}
        </li>
      `;
    }).join('');

    const broken = posts.filter((p) => !p.ok).map((p) =>
      `<li class="post-row"><div class="error">Failed to load <code>${escapeHtml(p.slug)}</code>: ${escapeHtml(p.error)}</div></li>`
    ).join('');

    viewEl.innerHTML = `<ul class="post-list">${items}${broken}</ul>`;
  }

  function renderPost(p) {
    if (headerEl) headerEl.hidden = true;
    introEl.hidden = true;

    const tagSpans = (p.tags || []).map((t) =>
      `<span class="tag">#${escapeHtml(t)}</span>`
    ).join(' ');
    const html = window.marked ? window.marked.parse(p.body) : `<pre>${escapeHtml(p.body)}</pre>`;

    viewEl.innerHTML = `
      <a class="back" href="#">&larr; all posts</a>
      <article class="post" id="${escapeHtml(p.slug)}">
        <h1>${escapeHtml(p.title)}</h1>
        <div class="post-meta">
          ${CAL_ICON}
          <time datetime="${escapeHtml(p.date)}">${escapeHtml(formatDate(p.date))}</time>
          <span class="dot">&bull;</span>
          <span>${escapeHtml(p.readTime)}</span>
          ${tagSpans ? `<span class="dot">&bull;</span><span class="post-tags">${tagSpans}</span>` : ''}
        </div>
        <div class="post-body">${html}</div>
      </article>
      <a class="back" href="#">&larr; all posts</a>
    `;

    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }

  // --- routing ---------------------------------------------------------

  function route() {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (hash) {
      const post = posts.find((p) => p.slug === hash && p.ok);
      if (post) { renderPost(post); return; }
    }
    renderList();
  }

  window.addEventListener('hashchange', route);
  route();
})();
