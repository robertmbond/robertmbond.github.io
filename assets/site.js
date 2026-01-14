const themeToggle = document.querySelector('[data-theme-toggle]');
const root = document.documentElement;
const storedTheme = localStorage.getItem('theme');

const applyTheme = (theme) => {
  if (theme) {
    root.setAttribute('data-theme', theme);
  } else {
    root.removeAttribute('data-theme');
  }
};

if (storedTheme) {
  applyTheme(storedTheme);
}

if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
    themeToggle.setAttribute('aria-pressed', next === 'dark');
  });
}

const publicationContainers = document.querySelectorAll('[data-publications]');

const formatLinks = (links = {}) => {
  const items = [];
  if (links.pdf) {
    items.push(`<a href="${links.pdf}">PDF</a>`);
  }
  if (links.doi) {
    items.push(`<a href="${links.doi}">DOI</a>`);
  }
  if (links.url) {
    items.push(`<a href="${links.url}">Link</a>`);
  }
  return items.join(' · ');
};

const buildBibtex = (items) => {
  return items
    .map((item, index) => {
      const authorKey = (item.authors || 'bond').split(',')[0].toLowerCase().replace(/\s+/g, '');
      const yearKey = item.year || 'nd';
      const titleKey = item.title
        .split(' ')[0]
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
      const key = `${authorKey}${yearKey}${titleKey}${index}`;
      const fields = [
        `  title = {${item.title}}`,
        `  author = {${item.authors}}`,
        item.venue ? `  journal = {${item.venue}}` : null,
        item.year ? `  year = {${item.year}}` : null,
        item.links?.doi ? `  doi = {${item.links.doi}}` : null,
        item.links?.url ? `  url = {${item.links.url}}` : item.links?.pdf ? `  url = {${item.links.pdf}}` : null,
      ].filter(Boolean);
      return `@article{${key},\n${fields.join(',\n')}\n}`;
    })
    .join('\n\n');
};

const renderPublications = (container, data, { limit } = {}) => {
  const list = container.querySelector('[data-publications-list]');
  const empty = container.querySelector('[data-publications-empty]');

  if (!list) return;

  let entries = data.filter((item) => !(item.tags || []).includes('comment'));

  if (container.dataset.publications === 'selected') {
    entries = entries.slice(0, limit || 8);
  }

  const searchInput = container.querySelector('[data-publications-search]');
  const yearSelect = container.querySelector('[data-publications-year]');
  const tagSelect = container.querySelector('[data-publications-tag]');
  const downloadButton = container.querySelector('[data-publications-download]');

  const years = Array.from(new Set(entries.map((item) => item.year).filter(Boolean))).sort((a, b) => b - a);
  const tags = Array.from(
    new Set(entries.flatMap((item) => item.tags || []).filter((tag) => tag && tag !== 'comment'))
  ).sort();

  if (yearSelect && yearSelect.options.length <= 1) {
    years.forEach((year) => {
      const option = document.createElement('option');
      option.value = year;
      option.textContent = year;
      yearSelect.appendChild(option);
    });
  }

  if (tagSelect && tagSelect.options.length <= 1) {
    tags.forEach((tag) => {
      const option = document.createElement('option');
      option.value = tag;
      option.textContent = tag;
      tagSelect.appendChild(option);
    });
  }

  const filterEntries = () => {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const year = yearSelect ? yearSelect.value : '';
    const tag = tagSelect ? tagSelect.value : '';

    let filtered = entries.filter((item) => {
      const haystack = `${item.title} ${item.authors} ${item.venue}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      const matchesYear = !year || String(item.year) === year;
      const matchesTag = !tag || (item.tags || []).includes(tag);
      return matchesQuery && matchesYear && matchesTag;
    });

    if (container.dataset.publications === 'selected') {
      filtered = filtered.slice(0, limit || 8);
    }

    list.innerHTML = filtered
      .map((item) => {
        const yearText = item.year ? item.year : 'n.d.';
        const tagMarkup = (item.tags || [])
          .filter((t) => t && t !== 'comment')
          .map((tagItem) => `<span class="tag">${tagItem}</span>`)
          .join('');
        return `
          <article class="publication">
            <h3>${item.title}</h3>
            <div class="meta">${item.authors} · ${item.venue || 'Working paper'} · ${yearText}</div>
            ${item.links ? `<div class="meta">${formatLinks(item.links)}</div>` : ''}
            ${tagMarkup ? `<div class="tag-list">${tagMarkup}</div>` : ''}
          </article>
        `;
      })
      .join('');

    if (empty) {
      empty.hidden = filtered.length > 0;
    }

    if (downloadButton) {
      downloadButton.onclick = () => {
        const bibtex = buildBibtex(filtered);
        const blob = new Blob([bibtex], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'publications.bib';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      };
    }
  };

  if (searchInput) searchInput.addEventListener('input', filterEntries);
  if (yearSelect) yearSelect.addEventListener('change', filterEntries);
  if (tagSelect) tagSelect.addEventListener('change', filterEntries);

  filterEntries();
};

if (publicationContainers.length > 0) {
  fetch('assets/publications.json')
    .then((response) => response.json())
    .then((data) => {
      publicationContainers.forEach((container) => renderPublications(container, data, { limit: 8 }));
    })
    .catch(() => {
      publicationContainers.forEach((container) => {
        const list = container.querySelector('[data-publications-list]');
        if (list) {
          list.innerHTML = '<p class="meta">Unable to load publications at this time.</p>';
        }
      });
    });
}
