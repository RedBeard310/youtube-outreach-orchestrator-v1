import { collectBookDepth } from '../../src/recovery/bloodhound-lane.js';
import { query } from 'pipeline-db';
async function main() {
  console.log('pool/stranded:', JSON.stringify(await collectBookDepth()));
  const b = await query(`
    SELECT
      count(*) AS stranded_total,
      count(*) FILTER (WHERE COALESCE(lc.external_links,'') NOT IN ('','[]')) AS has_links_free_resolve,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM leads.contact_points c2 WHERE c2.lead_id=lc.id AND c2.kind='website')) AS has_website_cp,
      count(*) FILTER (WHERE lc.outreach_status = ANY(ARRAY['no_email_found','email_invalid'])) AS right_outreach_status,
      count(*) FILTER (WHERE lc.signal_score >= 6) AS score_ge6
      FROM leads.lead_candidates lc
     WHERE lc.review_status='needs_contact'
       AND COALESCE(lc.do_not_contact,false)=false
       AND EXISTS (SELECT 1 FROM leads.contact_points cp WHERE cp.lead_id=lc.id)
       AND NOT EXISTS (SELECT 1 FROM leads.contact_points cp WHERE cp.lead_id=lc.id
                        AND cp.kind IN ('business_email','personal_email','youtube_email'))`, []);
  console.log('stranded_breakdown:', JSON.stringify(b[0]));
  console.log('kinds:', JSON.stringify(await query(`SELECT kind, count(*) AS n FROM leads.contact_points GROUP BY kind ORDER BY 2 DESC`, [])));
  console.log('cp_added_in_cycle:', JSON.stringify(await query(`SELECT count(*) AS n FROM leads.contact_points WHERE created_at >= '2026-09-12T07:00:00Z'`, [])));
  console.log('holds_gained:', JSON.stringify(await query(`SELECT count(*) AS n FROM leads.lead_candidates WHERE review_status='approved_hold'`, [])));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
