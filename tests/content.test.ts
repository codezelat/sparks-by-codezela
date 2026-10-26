import { describe, it, expect } from 'bun:test';
import { articleInput, safeHtml, plaintext } from '../src/lib/content';
import { signToken, verifyToken } from '../src/lib/auth';
import { spawnSync } from 'node:child_process';
describe('Editorial content safety', () => {
  it('handles discarded iframe nesting without overflowing the production Node stack', () => {
    const result = spawnSync(
      'node',
      [
        '--input-type=module',
        '-e',
        `import assert from 'node:assert/strict';
        import { safeHtml } from './src/lib/content.ts';
        for (const input of [
          '<iframe>'.repeat(4000),
          ('<iframe><b><b><b>').repeat(1000) + 'text',
        ]) {
          const output = safeHtml(input);
          assert.ok(!output.includes('<iframe'));
        }
        assert.equal(
          safeHtml('<h2 id="intro">Introduction</h2><p>Hello <strong>reader</strong>.</p>'),
          '<h2 id="intro">Introduction</h2><p>Hello <strong>reader</strong>.</p>',
        );`,
      ],
      { encoding: 'utf8', timeout: 10000 },
    );
    expect(result.error).toBeUndefined();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
  it('keeps headings, anchors and content while removing executable HTML', () => {
    const html = safeHtml(
      '<h2 id="intro">Introduction</h2><p>Hello <strong>reader</strong>.</p><script>alert(1)</script><img src="x" onerror="alert(1)"><a href="javascript:alert(1)">Bad</a>',
    );
    expect(html).toContain('id="intro"');
    expect(html).toContain('<strong>reader</strong>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('javascript:');
  });
  it('separates paragraphs in search text', () => {
    expect(plaintext('<p>First</p><p>Second</p>')).toBe('First Second');
  });
  it('validates published URLs and media schemes', () => {
    expect(
      articleInput.safeParse({
        title: 'Test',
        slug: '../admin',
        html: '',
        publishedAt: new Date().toISOString(),
      }).success,
    ).toBe(false);
    expect(
      articleInput.safeParse({
        title: 'Test',
        slug: 'test',
        html: '',
        featureImage: 'javascript:x',
        publishedAt: new Date().toISOString(),
      }).success,
    ).toBe(false);
  });
});
describe('Signed editor sessions', () => {
  const key = 'a'.repeat(64);
  const session = { id: '123', name: 'Editor', expires: Date.now() + 60000 };
  it('accepts valid tokens and rejects altered signatures and payloads', () => {
    const token = signToken(session, key);
    expect(verifyToken(token, key)?.id).toBe('123');
    expect(verifyToken(token + 'x', key)).toBeNull();
    expect(verifyToken('e30.' + token.split('.')[1], key)).toBeNull();
    expect(verifyToken(token, 'b'.repeat(64))).toBeNull();
  });
  it('rejects expired sessions and missing keys', () => {
    expect(
      verifyToken(signToken({ ...session, expires: 0 }, key), key),
    ).toBeNull();
    expect(verifyToken(signToken(session, key), '')).toBeNull();
  });
});
