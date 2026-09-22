import { describe, expect, it } from 'vitest';
import { boardIssues, getBoardPositions, saveBoardPositions } from '../src/model/board';
import { derivePisa, projectSignature } from '../src/model/pisa';
import { createDetachment, createProject, normalizeProject } from '../src/model/project';
import type { Person } from '../src/model/types';
import { validateProject } from '../src/model/validation';

function fixture() {
  const project = createProject();
  project.dets = ['early', 'main', 'other'].map((id, index) =>
    createDetachment({
      id,
      name: `Fiktiv ${id}`,
      ec: `T${index}`,
      datum: `2027-06-0${index + 1}`,
      bisDatum: `2027-06-0${index + 1}`,
      von: '08:00',
      ort: 'Fiktiver Ort',
      treffpunkt: 'Fiktives Tor',
      anzug: 'Fiktiv',
      entlassungsort: 'Fiktiver Ort',
    }),
  );
  project.persons = ['early', 'main', 'other'].map(
    (id): Person => ({
      id: `person-${id}`,
      name: `Fiktive Person ${id}`,
      grad: 'Wm',
      funktion: 'Test',
      lics: [],
      raw: {},
      planning: { status: 'included', reason: '' },
    }),
  );
  project.assign = Object.fromEntries(project.dets.map(({ id }) => [id, [`person-${id}`]]));
  return project;
}

describe('planning board layout', () => {
  it('arranges old projects deterministically with onward groups to the right', () => {
    const project = fixture();
    project.connections = [{ id: 'link', from: 'early', to: 'main' }];
    const before = structuredClone(project);
    const positions = getBoardPositions(project);
    expect(positions.main.x).toBeGreaterThan(positions.early.x);
    expect(positions.other.y).toBeGreaterThan(positions.early.y);
    expect(getBoardPositions(project)).toEqual(positions);
    expect(project).toEqual(before);
  });

  it('preserves saved positions through JSON normalization and ignores removed groups', () => {
    const project = fixture();
    saveBoardPositions(project, { early: { x: -120, y: 550 }, obsolete: { x: 0, y: 0 } });
    const normalized = normalizeProject(JSON.parse(JSON.stringify(project)));
    expect(getBoardPositions(normalized).early).toEqual({ x: -120, y: 550 });
    expect(Object.keys(normalized.board?.positions ?? {})).toEqual(['early', 'main', 'other']);
  });

  it('falls back safely for malformed saved coordinates and rejects invalid updates', () => {
    const project = fixture();
    const baseline = getBoardPositions(project);
    project.board = {
      positions: {
        early: { x: Number.POSITIVE_INFINITY, y: 0 },
        main: { x: 9_999_999, y: 0 },
        other: { x: 72, y: 90 },
      },
    };
    expect(getBoardPositions(project)).toEqual({ ...baseline, other: { x: 72, y: 90 } });
    saveBoardPositions(project, { other: { x: Number.NaN, y: 5 } });
    expect(getBoardPositions(project).other).toEqual({ x: 72, y: 90 });
  });

  it('handles invalid connection cycles without recursive loops', () => {
    const project = fixture();
    project.connections = [
      { id: 'forward', from: 'early', to: 'main' },
      { id: 'back', from: 'main', to: 'early' },
    ];
    expect(
      Object.values(getBoardPositions(project)).every(({ x, y }) => Number.isFinite(x + y)),
    ).toBe(true);
  });

  it('does not change PISA derivation or verification when cards move', () => {
    const project = fixture();
    const entries = derivePisa(project);
    const signature = projectSignature(project);
    saveBoardPositions(project, { early: { x: 555, y: -80 } });
    expect(derivePisa(project)).toEqual(entries);
    expect(projectSignature(project)).toBe(signature);
  });

  it('does not permit saved layout mutations in archives', () => {
    const project = fixture();
    project.archive = { id: 'fake-archive', at: '2027-01-01' };
    expect(() => saveBoardPositions(project, { early: { x: 0, y: 0 } })).toThrow(
      'schreibgeschützt',
    );
    expect(project.board).toBeUndefined();
  });
});

describe('planning board validation projection', () => {
  it('leaves complete groups clear and never mutates their data', () => {
    const project = fixture();
    const before = structuredClone(project);
    expect(boardIssues(project)).toEqual({
      byGroup: { early: [], main: [], other: [] },
      global: [],
    });
    expect(project).toEqual(before);
  });

  it('distinguishes missing details and EC from malformed EC conflicts', () => {
    const project = fixture();
    project.dets[0].ec = '';
    project.dets[0].ort = '';
    project.dets[1].ec = 'WRONG';
    const issues = boardIssues(project);
    expect(issues.byGroup.early).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-ec', severity: 'incomplete', action: 'details' }),
        expect.objectContaining({
          code: 'missing-details',
          severity: 'incomplete',
          action: 'details',
        }),
      ]),
    );
    expect(issues.byGroup.main).toContainEqual(
      expect.objectContaining({ code: 'invalid-ec', severity: 'conflict' }),
    );
  });

  it('puts a multiply assigned person conflict on every direct group', () => {
    const project = fixture();
    project.assign.main.push('person-early');
    const issues = boardIssues(project);
    for (const id of ['early', 'main'])
      expect(issues.byGroup[id]).toContainEqual(
        expect.objectContaining({
          code: 'multiple-assignments',
          personId: 'person-early',
          severity: 'conflict',
          action: 'people',
        }),
      );
    expect(issues.byGroup.other).toEqual([]);
    expect(issues.global).toEqual([]);
  });

  it('keeps unassigned people and policy confirmation visible globally', () => {
    const project = fixture();
    project.assign.other = [];
    project.connections = [{ id: 'link', from: 'early', to: 'main' }];
    const issues = boardIssues(project);
    expect(issues.global).toContainEqual(
      expect.objectContaining({ code: 'person-unassigned', action: 'people' }),
    );
    expect(issues.global).toContainEqual(
      expect.objectContaining({
        code: 'policy-unconfirmed',
        severity: 'incomplete',
        action: 'pisa',
      }),
    );
    expect(issues.byGroup.other).toContainEqual(
      expect.objectContaining({ code: 'empty-group', severity: 'incomplete' }),
    );
  });

  it('puts connection conflicts on both ends', () => {
    const project = fixture();
    project.dets[0].datum = '2027-06-20';
    project.connections = [{ id: 'link', from: 'early', to: 'main' }];
    const issues = boardIssues(project);
    for (const id of ['early', 'main'])
      expect(issues.byGroup[id]).toContainEqual(
        expect.objectContaining({
          code: 'connection-order',
          action: 'connections',
          severity: 'conflict',
        }),
      );
  });

  it('routes generated EC issues to PISA instead of editing the shared card EC', () => {
    const project = fixture();
    project.connections = [{ id: 'link', from: 'early', to: 'main' }];
    project.orderPolicy = { mode: 'separate', confirmedBy: 'Fiktiv', confirmedAt: '2027-01-01' };
    const generated = derivePisa(project).find((entry) => entry.generated);
    expect(generated).toBeDefined();
    expect(boardIssues(project).byGroup.main).toContainEqual(
      expect.objectContaining({
        code: 'invalid-ec',
        action: 'pisa',
        entryId: generated?.id,
        severity: 'incomplete',
      }),
    );
  });

  it('projects every existing issue without inventing validation rules', () => {
    const project = fixture();
    project.persons[0].planning.status = 'excluded';
    project.persons[1].identityReview = 'Fiktiver Abgleich';
    project.dets[2].von = '26:00';
    project.assign.missing = ['not-present'];
    const issues = boardIssues(project);
    const projected = [...issues.global, ...Object.values(issues.byGroup).flat()];
    for (const issue of validateProject(project))
      expect(projected).toContainEqual(
        expect.objectContaining({ code: issue.code, message: issue.message }),
      );
    for (const issue of projected)
      expect(validateProject(project)).toContainEqual(
        expect.objectContaining({ code: issue.code, message: issue.message }),
      );
  });

  it('routes continuous entry start details back to their original card', () => {
    const project = fixture();
    project.connections = [{ id: 'link', from: 'early', to: 'main' }];
    project.orderPolicy = { mode: 'continuous', confirmedBy: 'Fiktiv', confirmedAt: '2027-01-01' };
    project.dets[0].ort = '';
    project.dets[0].von = '26:00';
    const issues = boardIssues(project);
    for (const id of ['early', 'main']) {
      expect(issues.byGroup[id]).toContainEqual(
        expect.objectContaining({
          code: 'missing-details',
          action: 'details',
          correctionGroupId: 'early',
          severity: 'incomplete',
        }),
      );
      expect(issues.byGroup[id]).toContainEqual(
        expect.objectContaining({
          code: 'invalid-time',
          action: 'details',
          correctionGroupId: 'early',
          severity: 'conflict',
        }),
      );
    }
  });

  it('routes continuous final details to their main card and ambiguous dates to both endpoints', () => {
    const project = fixture();
    project.connections = [{ id: 'link', from: 'early', to: 'main' }];
    project.orderPolicy = { mode: 'continuous', confirmedBy: 'Fiktiv', confirmedAt: '2027-01-01' };
    project.dets[1].entlassungsort = '';
    project.dets[0].datum = 'not-a-date';
    const issues = boardIssues(project);
    expect(issues.byGroup.main).toContainEqual(
      expect.objectContaining({
        code: 'missing-details',
        action: 'details',
        correctionGroupId: 'main',
      }),
    );
    for (const id of ['early', 'main'])
      expect(issues.byGroup[id]).toContainEqual(
        expect.objectContaining({
          code: 'invalid-date',
          action: 'connections',
          severity: 'conflict',
        }),
      );
  });

  it('keeps generated missing EC in PISA while generated missing shared details stay editable on cards', () => {
    const project = fixture();
    project.connections = [{ id: 'link', from: 'early', to: 'main' }];
    project.orderPolicy = { mode: 'separate', confirmedBy: 'Fiktiv', confirmedAt: '2027-01-01' };
    project.dets[1].ort = '';
    const generated = derivePisa(project).find((entry) => entry.generated);
    const issues = boardIssues(project).byGroup.main;
    expect(issues).toContainEqual(
      expect.objectContaining({ code: 'invalid-ec', entryId: generated?.id, action: 'pisa' }),
    );
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: 'missing-details',
        entryId: generated?.id,
        action: 'details',
        correctionGroupId: 'main',
      }),
    );
  });
});
