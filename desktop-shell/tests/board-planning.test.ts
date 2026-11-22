import { describe, expect, it } from 'vitest';
import { buildBoardForecast, estimateMinutes, formatMinuteRange, type ForecastItem } from '../src/renderer/boards/planning';

const est = (o: number, m = o, p = m) => ({ optimisticMinutes: o, likelyMinutes: m, pessimisticMinutes: p });
const item = (id: string, emp: string, rev: string, deps: string[], e: number, r: number, extra: Partial<ForecastItem> = {}): ForecastItem =>
  ({ id, employeeId: emp, reviewerEmployeeId: rev, dependsOn: deps, estimate: est(e), reviewEstimate: est(r), ...extra });
const codes = (items: ForecastItem[]) => buildBoardForecast(items).issues.map((i) => i.code);

describe('estimateMinutes', () => {
  it('weights hand-checked values and rejects bad input', () => {
    expect(estimateMinutes(est(6, 12, 18))?.weighted).toBe(12);
    expect(estimateMinutes(est(0.5, 1.25, 2.5))?.optimistic).toBe(0.5);
    for (const bad of [null, 3, est(0), est(5, 4, 6), est(1, 2, 1441), { optimisticMinutes: NaN, likelyMinutes: 1, pessimisticMinutes: 1 }]) {
      expect(estimateMinutes(bad)).toBeNull();
    }
  });
});

describe('buildBoardForecast', () => {
  it('empty graph is valid and complete with zero ranges', () => {
    const f = buildBoardForecast([]);
    expect(f.valid && f.complete).toBe(true);
    expect(f.dependencyMinutes?.likely).toBe(0);
    expect(f.staffedMinutes?.pessimistic).toBe(0);
  });

  it('fork/join includes review phases (hand calculated)', () => {
    // A: 10+2=12. B: 5+1=6 after A, C: 8+3=11 after A, D: 4+2=6 after B,C.
    // Critical path A->C->D = 12+11+6 = 29.
    const f = buildBoardForecast([
      item('A', 'e1', 'r1', [], 10, 2), item('B', 'e2', 'r2', ['A'], 5, 1),
      item('C', 'e3', 'r3', ['A'], 8, 3), item('D', 'e4', 'r4', ['B', 'C'], 4, 2),
    ]);
    expect(f.valid && f.complete).toBe(true);
    expect(f.dependencyMinutes?.likely).toBe(29);
    expect(f.staffedMinutes?.likely).toBe(29);
    expect(f.estimateCoverage).toEqual({ known: 8, total: 8 });
  });

  it('reviewer contention makes staffed > dependency', () => {
    // Two independent items, both reviewed by r. Dependency: 3+2=5. Staffed: r reviews 3..5 then 5..7 => 7.
    const f = buildBoardForecast([item('a', 'e1', 'r', [], 3, 2), item('b', 'e2', 'r', [], 3, 2)]);
    expect(f.dependencyMinutes?.likely).toBe(5);
    expect(f.staffedMinutes?.likely).toBe(7);
  });

  it('cross-role contention: producer is busy reviewing', () => {
    // Greedy serial scheduling reserves y for a's review (4..5) before b.
    // It does not backfill that employee's 0..4 gap: b is 5..9, review 9..10.
    const f = buildBoardForecast([item('a', 'x', 'y', [], 4, 1), item('b', 'y', 'x', [], 4, 1)]);
    expect(f.dependencyMinutes?.likely).toBe(5);
    expect(f.staffedMinutes?.likely).toBe(10);
    // Chain sharing a person: b depends on a, same person primary on both: serial 4+1 then 4+1 = 10.
    const g = buildBoardForecast([item('a', 'x', 'y', [], 4, 1), item('b', 'x', 'y', ['a'], 4, 1)]);
    expect(g.staffedMinutes?.likely).toBe(10);
    // Reviewer y reviewing a (4..5) blocks y producing c until 5.
    const h = buildBoardForecast([item('a', 'x', 'y', [], 4, 1), item('c', 'y', 'z', [], 2, 1)]);
    expect(h.dependencyMinutes?.likely).toBe(5);
    expect(h.staffedMinutes?.likely).toBe(8);
  });

  it('rejects self review, missing reviewer', () => {
    expect(codes([item('a', 'x', 'x', [], 1, 1)])).toContain('self-review');
    expect(codes([{ id: 'a', employeeId: 'x', dependsOn: [], estimate: est(1), reviewEstimate: est(1) }])).toContain('missing-reviewer');
  });

  it('unknown estimates are incomplete; invalid are invalid', () => {
    const unknown = buildBoardForecast([item('a', 'x', 'y', [], 1, 1, { reviewEstimate: null })]);
    expect(unknown.valid).toBe(true);
    expect(unknown.complete).toBe(false);
    expect(unknown.dependencyMinutes).toBeNull();
    expect(unknown.estimateCoverage).toEqual({ known: 1, total: 2 });
    expect(unknown.issues[0]?.code).toBe('estimate-missing');
    const invalid = buildBoardForecast([item('a', 'x', 'y', [], 1, 1, { estimate: est(0) })]);
    expect(invalid.valid).toBe(false);
    expect(invalid.issues.map((i) => i.code)).toContain('invalid-estimate');
  });

  it('blocked items make aggregate null but keep coverage', () => {
    const f = buildBoardForecast([item('a', 'x', 'y', [], 1, 1, { blocked: true }), item('b', 'x', 'y', ['a'], 1, 1)]);
    expect(f.valid).toBe(true);
    expect(f.complete).toBe(false);
    expect(f.staffedMinutes).toBeNull();
    expect(f.estimateCoverage).toEqual({ known: 4, total: 4 });
    expect(f.issues[0]?.code).toBe('work-blocked');
  });

  it('accepted predecessor has zero remaining duration and needs no staff', () => {
    const f = buildBoardForecast([
      { id: 'a', employeeId: '', dependsOn: [], accepted: true },
      item('b', 'x', 'y', ['a'], 3, 2),
    ]);
    expect(f.valid && f.complete).toBe(true);
    expect(f.dependencyMinutes?.likely).toBe(5);
    expect(f.estimateCoverage).toEqual({ known: 2, total: 2 });
  });

  it('rejects cycles, duplicates, dangling, self links, duplicate edges without throwing', () => {
    expect(codes([item('a', 'x', 'y', ['b'], 1, 1), item('b', 'x', 'y', ['a'], 1, 1)])).toContain('cycle');
    expect(codes([item('a', 'x', 'y', [], 1, 1), item('a', 'x', 'y', [], 1, 1)])).toContain('duplicate-id');
    expect(codes([item('a', 'x', 'y', ['zz'], 1, 1)])).toContain('unknown-dependency');
    expect(codes([item('a', 'x', 'y', ['a'], 1, 1)])).toContain('self-dependency');
    expect(codes([item('a', 'x', 'y', [], 1, 1), item('b', 'x', 'y', ['a', 'a'], 1, 1)])).toContain('duplicate-edge');
    const f = buildBoardForecast([item('a', 'x', 'y', ['b'], 1, 1), item('b', 'x', 'y', ['a'], 1, 1)]);
    expect(f.valid).toBe(false);
    expect(f.dependencyMinutes).toBeNull();
  });

  it('is permutation invariant, deterministic and does not mutate frozen input', () => {
    const base = [
      item('A', 'e1', 'r1', [], 10, 2), item('B', 'e1', 'r1', ['A'], 5, 1),
      item('C', 'e2', 'r1', ['A'], 8, 3), item('D', 'e2', 'r2', ['B', 'C'], 4, 2),
    ];
    const frozen = base.map((i) => Object.freeze({ ...i, dependsOn: Object.freeze([...i.dependsOn]) }));
    Object.freeze(frozen);
    const f1 = buildBoardForecast(frozen);
    const f2 = buildBoardForecast([...frozen].reverse());
    expect(f2.staffedMinutes).toEqual(f1.staffedMinutes);
    expect(f2.dependencyMinutes).toEqual(f1.dependencyMinutes);
    expect(f2.order).toEqual(f1.order);
    expect(buildBoardForecast(frozen)).toEqual(f1);
    expect(frozen.map((i) => i.id)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('handles a large bounded chain and rejects over-cap graphs', () => {
    const chain: ForecastItem[] = [];
    for (let i = 0; i < 1000; i++) chain.push(item(`n${i}`, 'x', 'y', i ? [`n${i - 1}`] : [], 1, 1));
    const f = buildBoardForecast(chain);
    expect(f.valid).toBe(true);
    expect(f.dependencyMinutes?.likely).toBe(2000);
    expect(f.staffedMinutes?.likely).toBe(2000);
    const over = [...chain, item('extra', 'x', 'y', [], 1, 1)];
    expect(buildBoardForecast(over).issues[0]?.code).toBe('too-many-items');
    const wide: ForecastItem[] = [item('root', 'x', 'y', [], 1, 1)];
    for (let i = 0; i < 25; i++) wide.push(item(`w${i}`, 'x', 'y', Array.from({ length: 999 }, (_, k) => `w${k}`), 1, 1));
    expect(buildBoardForecast(wide).valid).toBe(false);
  });

  it('preserves decimal estimates and byte-exact malicious ids', () => {
    const ids = ['__proto__', 'constructor', 'sk-live-ABC123', ' spaced '];
    const f = buildBoardForecast([
      item(ids[0] as string, 'x', 'y', [], 0.25, 0.5),
      item(ids[1] as string, 'sk-live-ABC123', ' spaced ', [ids[0] as string], 0.125, 0.25),
    ]);
    expect(f.valid).toBe(true);
    expect(f.order).toEqual(['__proto__', 'constructor']);
    expect(f.dependencyMinutes?.likely).toBeCloseTo(1.125, 10);
    expect(codes([item('', 'x', 'y', [], 1, 1)])).toContain('invalid-id');
    expect(codes([item('a'.repeat(161), 'x', 'y', [], 1, 1)])).toContain('invalid-id');
  });

  it('PERT scenario switch: weighted critical path differs from aggregate of bounds', () => {
    // P: production (0.01..) use two parallel items, no review contention (distinct staff).
    // X: o=1,m=10,p=100 -> w=(1+40+100)/6=23.5 ; review 1 each.
    // Y: o=30,m=30,p=30 -> w=30 ; review 1 each.
    // optimistic: max(1+1, 30+1)=31; likely: max(11, 31)=31; pessimistic: max(101, 31)=101.
    // weighted per-phase: X=23.5+1=24.5, Y=31 -> weighted makespan 31 (Y path),
    // while weighted-from-aggregates would be (31+4*31+101)/6 = 42.67 (a different, wrong number).
    const f = buildBoardForecast([
      { id: 'X', employeeId: 'a', reviewerEmployeeId: 'b', dependsOn: [], estimate: est(1, 10, 100), reviewEstimate: est(1) },
      { id: 'Y', employeeId: 'c', reviewerEmployeeId: 'd', dependsOn: [], estimate: est(30), reviewEstimate: est(1) },
    ]);
    expect(f.dependencyMinutes).toEqual({ optimistic: 31, likely: 31, pessimistic: 101, weighted: 31 });
  });

  it('dependency result never exceeds staffed result', () => {
    const f = buildBoardForecast([
      item('a', 'x', 'y', [], 2, 1), item('b', 'x', 'y', [], 3, 2), item('c', 'y', 'x', ['a'], 1, 1),
    ]);
    const d = f.dependencyMinutes, s = f.staffedMinutes;
    expect(d && s && d.optimistic <= s.optimistic && d.likely <= s.likely && d.pessimistic <= s.pessimistic && d.weighted <= s.weighted).toBe(true);
  });

  it('assumptions state limitations', () => {
    const text = buildBoardForecast([]).assumptions.join(' ');
    for (const k of ['lower bound', 'one slot', 'calendar', 'not a confidence', 'full remaining']) expect(text).toContain(k);
  });
});

describe('formatMinuteRange', () => {
  it('formats null and rounds without negatives or NaN', () => {
    expect(formatMinuteRange(null)).toBe('Estimate not available');
    const s = formatMinuteRange({ optimistic: 29.6, likely: 75, pessimistic: 180, weighted: 90 });
    expect(s).toContain('Lower 30 min');
    expect(s).toContain('likely 1 h 15 min');
    expect(s).toContain('upper 3 h');
    const bad = formatMinuteRange({ optimistic: -5, likely: NaN, pessimistic: Infinity, weighted: 0 });
    expect(bad).toBe('Estimate not available');
    expect(formatMinuteRange({optimistic:0.1,likely:0.5,pessimistic:0.9,weighted:0.5})).toContain('<1 min');
  });
});
