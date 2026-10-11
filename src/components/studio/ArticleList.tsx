import { useEffect, useState } from 'react';
import type { StudioArticle } from '../../lib/content';
import { dateLabel } from '../../lib/format';
type Result = { articles: StudioArticle[]; total: number };
export default function ArticleList({
  initial,
  kind = 'post',
}: {
  initial: Result;
  kind?: 'post' | 'page';
}) {
  const [data, setData] = useState(initial),
    [q, setQ] = useState(''),
    [status, setStatus] = useState(''),
    [page, setPage] = useState(1),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    const timeout = setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `/api/studio/articles/?q=${encodeURIComponent(q)}&status=${status}&page=${page}&kind=${kind}`,
          { signal: abort.signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setData(result);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setError((e as Error).message);
      } finally {
        if (!abort.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timeout);
      abort.abort();
    };
  }, [q, status, page, kind]);
  return (
    <>
      <div className="studio-page-head">
        <h1>{kind === 'page' ? 'Pages' : 'Articles'}</h1>
        <a className="button primary" href={`/studio/new/?kind=${kind}`}>
          + {kind === 'page' ? 'New page' : 'New article'}
        </a>
      </div>
      <label className="studio-search">
        <span className="sr-only">Search articles</span>
        <input
          placeholder="Search articles"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </label>
      <div className="studio-tabs" role="group" aria-label="Filter articles">
        {[
          ['', 'All'],
          ['published', 'Published'],
          ['draft', 'Drafts'],
        ].map(([value, label]) => (
          <button
            key={value}
            className={status === value ? 'active' : ''}
            aria-pressed={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="table-wrap" aria-busy={loading}>
        <table className="article-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Published</th>
              <th>
                <span className="sr-only">Action</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.articles.map((article) => (
              <tr key={article.id}>
                <td>
                  <a href={`/studio/edit/${article.id}/`}>{article.title}</a>
                </td>
                <td>
                  <span className={`status-dot ${article.status}`} />
                  {article.hasDraft && article.status === 'published'
                    ? 'Unpublished edits'
                    : article.status === 'published'
                      ? 'Published'
                      : 'Draft'}
                </td>
                <td>
                  {article.publishedAt
                    ? dateLabel(String(article.publishedAt))
                    : 'Not published'}
                </td>
                <td>
                  <a
                    className="edit-link"
                    href={`/studio/edit/${article.id}/`}
                    aria-label={`Edit ${article.title}`}
                  >
                    Edit
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.articles.length && !loading && (
          <p className="empty-state">No articles found.</p>
        )}
      </div>
      <nav className="studio-pagination" aria-label="Pagination">
        <button
          className="button"
          disabled={page === 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <button
          className="button"
          disabled={page * 20 >= data.total || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
        <span className="muted">
          {page} / {Math.max(1, Math.ceil(data.total / 20))}
        </span>
      </nav>
    </>
  );
}
