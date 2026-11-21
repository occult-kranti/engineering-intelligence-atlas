import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const entries=fs.readFileSync(path.join(root,'project/worker-ledger.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line));
const lines=['# Shared worker ledger','','User-visible task briefs and result summaries. This is a delivery record, not a transcript of private model reasoning. Credentials and raw internal reasoning are excluded.',''];
for (const entry of entries) {
  lines.push(`## ${entry.id} · ${entry.worker} · ${entry.status}`,'',`- **Ask:** ${entry.ask}`,`- **Expected return:** ${entry.expected}`,`- **Returned:** ${entry.returned}`,`- **Evidence:** ${entry.evidence.join('; ')}`,`- **Next handoff:** ${entry.next}`,'');
}
fs.writeFileSync(path.join(root,'project/WORKER_LEDGER.md'),lines.join('\n'));
const timeline=['# Timeline index','','Follow the numbered records for the delivery sequence. Dates belong to the repository import and rebuild on 20 November 2026; exact runtime event timestamps are recorded by the application.','',...entries.map(e=>`- **${e.id}: ${e.worker}** — ${e.ask} → ${e.returned} ([ledger](project/WORKER_LEDGER.md))`),'','Related: [Roadmap](ROADMAP.md) · [Handoff](HANDOFF.md) · [Backend research](project/BACKEND_RESEARCH.md) · [Claude usage](project/CLAUDE_USAGE.md)'];
fs.writeFileSync(path.join(root,'TIMELINE.md'),timeline.join('\n')+'\n');
console.log(`Rendered ${entries.length} worker ledger entries.`);
