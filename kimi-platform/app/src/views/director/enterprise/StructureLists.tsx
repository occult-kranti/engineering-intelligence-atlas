import type { SnapshotLike } from "./adapter";

/**
 * Canonical lists for the structure section. Rows come from the SAME
 * contract-derived view as the graph (deriveEnterpriseView on the server) —
 * keys are identical by construction, so selecting a row highlights the
 * graph node and vice versa.
 */
export default function StructureLists({
  snapshot,
  selectedKey,
  onSelect,
}: {
  snapshot: SnapshotLike;
  selectedKey: string | null;
  onSelect(key: string | null): void;
}) {
  const view = snapshot.view;
  if (!view) return null;
  const rowProps = (key: string) => ({
    "data-selected": selectedKey === key || undefined,
    className: `cursor-pointer ${selectedKey === key ? "ent-row-selected" : ""}`,
    onClick: () => onSelect(selectedKey === key ? null : key),
  });
  return (
    <div className="grid gap-4 lg:grid-cols-3" aria-label="Canonical structure lists">
      <section className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Companies ({view.lists.companies.length})</span>
        <table className="table-cat mt-2 text-[12px]">
          <thead>
            <tr><th>key</th><th>kind</th><th>share</th><th>depts</th><th>contracts</th></tr>
          </thead>
          <tbody>
            {view.lists.companies.map((c) => (
              <tr key={c.key} {...rowProps(c.key)} aria-label={`company ${c.key}`}>
                <td className="mono font-bold">{c.key}</td>
                <td>{c.kind}</td>
                <td className="mono">{c.capacityShare}</td>
                <td className="mono">{c.departmentCount}</td>
                <td className="mono">{c.contractCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Departments ({view.lists.departments.length})</span>
        <table className="table-cat mt-2 text-[12px]">
          <thead>
            <tr><th>key</th><th>owner</th><th>discipline</th><th>contracts</th></tr>
          </thead>
          <tbody>
            {view.lists.departments.map((d) => (
              <tr key={d.key} {...rowProps(d.key)} aria-label={`department ${d.key}`}>
                <td className="mono font-bold">{d.key}</td>
                <td className="mono">{d.companyKey}</td>
                <td>{d.discipline}</td>
                <td className="mono">{d.contractCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3">
        <span className="kicker">Contracts ({view.lists.contracts.length})</span>
        <table className="table-cat mt-2 text-[12px]">
          <thead>
            <tr><th>key</th><th>status</th><th>staffed</th></tr>
          </thead>
          <tbody>
            {view.lists.contracts.map((w) => (
              <tr key={w.key} {...rowProps(w.key)} aria-label={`contract ${w.key}`}>
                <td className="mono font-bold">{w.key}</td>
                <td>{w.status}</td>
                <td>{w.staffed ? "staffed" : "unstaffed"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
