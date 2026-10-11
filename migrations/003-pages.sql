ALTER TABLE articles ADD COLUMN kind text NOT NULL DEFAULT 'post' CHECK (kind IN ('post','page'));
UPDATE articles SET published=published || jsonb_build_object('kind',kind) WHERE published IS NOT NULL;
UPDATE articles SET draft=draft || jsonb_build_object('kind',kind) WHERE draft IS NOT NULL;
CREATE INDEX articles_kind_date ON articles(kind,published_at DESC) WHERE published IS NOT NULL;
