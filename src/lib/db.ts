import { neon } from '@neondatabase/serverless';
export type Query = <T extends Record<string, any> = Record<string, any>>(
  text: string,
  params?: any[],
) => Promise<T[]>;
function env(name: string): string | undefined {
  return import.meta.env[name] || process.env[name];
}
export const localStudio = () =>
  import.meta.env.DEV && env('LOCAL_STUDIO') === 'true';
export const hasDatabase = () => Boolean(env('DATABASE_URL')) || localStudio();
let query: Query | undefined;
export async function database(): Promise<Query> {
  if (query) return query;
  const url = env('DATABASE_URL');
  if (url) {
    const sql = neon(url);
    query = (text, params = []) => sql.query(text, params) as Promise<any[]>;
    return query;
  }
  if (import.meta.env.DEV && localStudio()) {
    const { developmentDatabase } = await import('./dev-db');
    query = await developmentDatabase();
    return query;
  }
  throw new Error(
    'DATABASE_URL is required. Production never uses a local database.',
  );
}
