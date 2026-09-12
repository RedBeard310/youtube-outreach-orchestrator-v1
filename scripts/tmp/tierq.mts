import { query } from 'pipeline-db';
const q = async (l: string, s: string) => console.log('\n'+l+'\n', JSON.stringify(await query(s, []), null, 0));
const stuck = `lc.review_status='needs_contact'
     AND EXISTS (SELECT 1 FROM leads.contact_points cp WHERE cp.lead_id=lc.id)
     AND NOT EXISTS (SELECT 1 FROM leads.contact_points cp WHERE cp.lead_id=lc.id AND cp.kind IN ('business_email','personal_email','youtube_email'))`;
await q('STUCK leads: contact-point kinds they DO have:',
  `SELECT cp.kind, count(DISTINCT lc.id)::int leads FROM leads.lead_candidates lc JOIN leads.contact_points cp ON cp.lead_id=lc.id
    WHERE ${stuck} GROUP BY 1 ORDER BY 2 DESC LIMIT 20`);
await q('STUCK leads: how many points each (buckets):',
  `SELECT n_pts, count(*)::int leads FROM (SELECT lc.id, count(cp.id)::int n_pts FROM leads.lead_candidates lc JOIN leads.contact_points cp ON cp.lead_id=lc.id WHERE ${stuck} GROUP BY 1) t GROUP BY 1 ORDER BY 1 LIMIT 12`);
await q('needs_contact WITH an email-kind point, by verify-state:',
  `SELECT COALESCE(cp.verified,false) verified, (cp.verified_at IS NOT NULL) ruled, count(DISTINCT lc.id)::int leads
     FROM leads.lead_candidates lc JOIN leads.contact_points cp ON cp.lead_id=lc.id
    WHERE lc.review_status='needs_contact' AND cp.kind IN ('business_email','personal_email','youtube_email')
    GROUP BY 1,2 ORDER BY 3 DESC`);
process.exit(0);
