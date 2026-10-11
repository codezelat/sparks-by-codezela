CREATE TABLE IF NOT EXISTS articles (
  id text PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  published jsonb,
  draft jsonb,
  version integer NOT NULL DEFAULT 1,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(published->>'title','')), 'A') ||
    to_tsvector('english', coalesce(published->>'plaintext',''))
  ) STORED,
  CONSTRAINT has_content CHECK (published IS NOT NULL OR draft IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS articles_published_date ON articles(published_at DESC, id) WHERE published IS NOT NULL;
CREATE INDEX IF NOT EXISTS articles_search ON articles USING gin(search_vector);
CREATE INDEX IF NOT EXISTS articles_tags ON articles USING gin((published->'tags'));
CREATE INDEX IF NOT EXISTS articles_authors ON articles USING gin((published->'authors'));
CREATE TABLE IF NOT EXISTS revisions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  article_id text NOT NULL REFERENCES articles(id),
  content jsonb NOT NULL,
  action text NOT NULL CHECK (action IN ('draft','publish')),
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS revisions_article ON revisions(article_id, created_at DESC);
