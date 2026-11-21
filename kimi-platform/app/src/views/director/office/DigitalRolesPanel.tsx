import { DIGITAL_ROLE_DEFS, type DigitalRoleId, type DigitalRoleStatus } from "./model";

export default function DigitalRolesPanel({ roles }: { roles: DigitalRoleStatus[] }) {
  const byId = new Map(roles.map((r) => [r.id, r]));
  return (
    <section aria-labelledby="ob-roles-heading" className="flex flex-col gap-3">
      <h2 id="ob-roles-heading" className="kicker">
        Permanent digital roles
      </h2>
      {(Object.keys(DIGITAL_ROLE_DEFS) as DigitalRoleId[]).map((id) => {
        const def = DIGITAL_ROLE_DEFS[id];
        const status = byId.get(id);
        return (
          <article
            key={id}
            className="border border-[hsl(var(--line))] bg-[hsl(var(--paper-raised))] p-3"
            data-role={id}
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block size-2 rounded-full"
                style={{ background: "hsl(var(--sage))" }}
              />
              <h3 className="text-[14px] font-extrabold">{def.name}</h3>
              <span className="chip chip-neutral ml-auto">subagent</span>
            </div>
            <p className="mt-1 text-[13px] text-[hsl(var(--ink-soft))]">
              {status?.activity.status === "live"
                ? status.activity.data
                : (status?.activity.status === "unavailable" ? status.activity.reason : def.purpose)}
            </p>
            {status?.mode === "rules-only" ? (
              <p className="chip chip-mustard mt-1">
                rules-only mode — provider unconfigured; AI summaries unavailable
              </p>
            ) : null}
            <ul className="mt-2 flex flex-wrap gap-1" aria-label={`${def.name} hard limits`}>
              {def.limitChips.map((c) => (
                <li key={c} className="chip chip-mustard">
                  {c}
                </li>
              ))}
            </ul>
            <p className="mono mt-1 text-[11px] text-[hsl(var(--ink-soft))]">
              tool verbs: {def.toolVerbs}
            </p>
          </article>
        );
      })}
    </section>
  );
}
