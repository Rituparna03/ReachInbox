import { Client } from '@elastic/elasticsearch';
import { config } from '../config';

// Elasticsearch is optional at runtime: with no ELASTICSEARCH_URL we skip indexing and search falls back to SQL.
export const searchEnabled = !!config.esUrl;
export const es = new Client({
  node: config.esUrl || 'http://localhost:9200',
  ...(config.esApiKey ? { auth: { apiKey: config.esApiKey } } : {}),
});
const INDEX = 'emails';

export async function initSearch() {
  if (!searchEnabled) { console.warn('[search] ELASTICSEARCH_URL not set, using SQL fallback'); return; }
  try {
    if (!(await es.indices.exists({ index: INDEX }))) {
      await es.indices.create({
        index: INDEX,
        mappings: { properties: {
          userId: { type: 'keyword' }, status: { type: 'keyword' },
          toEmail: { type: 'text', fields: { raw: { type: 'keyword' } } },
          subject: { type: 'text' }, body: { type: 'text' }, scheduledAt: { type: 'date' }, sentAt: { type: 'date' },
        } },
      });
    }
  } catch (e) { console.warn('[search] Elasticsearch unavailable:', (e as Error).message); }
}

export interface EmailDoc { id: string; userId: string; toEmail: string; subject: string; body: string; status: string; scheduledAt: string; sentAt?: string | null }

// Indexing is best-effort: Postgres is the source of truth; search must never block sending.
export async function indexEmails(docs: EmailDoc[]) {
  if (!docs.length || !searchEnabled) return;
  try {
    await es.bulk({ refresh: false, operations: docs.flatMap(d => [{ index: { _index: INDEX, _id: d.id } }, d]) });
  } catch (e) { console.warn('[search] index failed:', (e as Error).message); }
}
export async function updateEmailDoc(id: string, patch: Partial<EmailDoc>) {
  if (!searchEnabled) return;
  try { await es.update({ index: INDEX, id, doc: patch }); } catch (e) { console.warn('[search] update failed:', (e as Error).message); }
}
export async function searchEmailIds(userId: string, q: string, statuses: string[]) {
  if (!searchEnabled) throw new Error('search disabled');
  const r = await es.search<EmailDoc>({
    index: INDEX, size: 500,
    query: { bool: {
      filter: [{ term: { userId } }, { terms: { status: statuses } }],
      must: [{ multi_match: { query: q, fields: ['toEmail', 'subject', 'body'], fuzziness: 'AUTO' } }],
    } },
  });
  return r.hits.hits.map(h => h._id as string);
}
