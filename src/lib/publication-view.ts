import MiniSearch from 'minisearch';
import { summary, type Article } from './content';

export function publicationView(articles: Article[], now = Date.now) {
  const bySlug = new Map(articles.map((article) => [article.slug, article]));
  let searchIndex: MiniSearch | undefined;
  const visible = (article: Article) =>
    Date.parse(article.publishedAt) <= now();
  const posts = () =>
    articles.filter((article) => article.kind === 'post' && visible(article));
  return {
    get(slug: string) {
      const article = bySlug.get(slug);
      return article && visible(article) ? article : undefined;
    },
    latest(limit = 4) {
      return posts().slice(0, limit).map(summary);
    },
    list({ page = 1, limit = 12, search = '', tag = '', author = '' } = {}) {
      let matches = posts().filter(
        (article) =>
          (!tag || article.tags.includes(tag)) &&
          (!author || article.authors.includes(author)),
      );
      if (search.trim()) {
        if (!searchIndex) {
          searchIndex = new MiniSearch({
            fields: ['title', 'excerpt', 'plaintext', 'tags'],
            extractField: (document, field) =>
              field === 'tags' ? document.tags.join(' ') : document[field],
            searchOptions: {
              prefix: true,
              combineWith: 'AND',
              boost: { title: 4, excerpt: 2 },
            },
          });
          searchIndex.addAll(
            articles.filter((article) => article.kind === 'post'),
          );
        }
        const ranks = new Map(
          searchIndex
            .search(search.slice(0, 200))
            .map((hit) => [hit.id, hit.score]),
        );
        matches = matches.filter(
          (article) =>
            ranks.has(article.id) ||
            article.title.toLowerCase().includes(search.toLowerCase()),
        );
        matches.sort((a, b) => (ranks.get(b.id) || 0) - (ranks.get(a.id) || 0));
      }
      return {
        articles: matches.slice((page - 1) * limit, page * limit).map(summary),
        total: matches.length,
      };
    },
    urls() {
      return posts().map(({ slug, publishedAt, updatedAt, canonicalUrl }) => ({
        slug,
        publishedAt,
        updatedAt,
        canonicalUrl,
      }));
    },
    pageUrls() {
      return articles
        .filter((article) => article.kind === 'page' && visible(article))
        .map(({ slug, updatedAt }) => ({ slug, updatedAt }));
    },
  };
}
