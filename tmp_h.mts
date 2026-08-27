import { query } from 'pipeline-db';
const rows = await query<any>(`
 SELECT to_char(date_trunc('hour', created_at) AT TIME ZONE 'UTC','YYYY-MM-DD HH24') h,
        count(*) total,
        count(*) FILTER (WHERE signal_score >= 6) good
 FROM leads.lead_candidates
 WHERE created_at >= '2026-08-26T07:00:00Z' AND created_at < '2026-08-27T07:00:00Z'
 GROUP BY 1 ORDER BY 1`);
console.log('total=[' + rows.map(r=>r.total).join(',') + ']');
console.log('good=[' + rows.map(r=>r.good).join(',') + ']');
console.log('hours', rows.length, rows[0]?.h, rows[rows.length-1]?.h);
const sums = await query<any>(`SELECT sum(total) t, sum(good) g FROM (SELECT count(*) total, count(*) FILTER (WHERE signal_score>=6) good FROM leads.lead_candidates WHERE created_at >= '2026-08-26T07:00:00Z' AND created_at < '2026-08-27T07:00:00Z' GROUP BY date_trunc('hour',created_at)) x`);
console.log('sums', sums[0]);
process.exit(0);
