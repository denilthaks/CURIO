// Data-modelling lab: interaction state (a pure reducer) and a deterministic
// validator. No DOM or React here, so every rule is unit-tested.
//
// The validator judges the learner's model against explicit rules using the
// lab's sample data: key uniqueness and foreign-key matching are computed
// from the rows, not looked up from an answer list.

import type { Cardinality, ColumnRef, FilterDirection, LabModel, LabRelationship, LabTable, SchemaScene } from './types';

// ---- Data helpers ----

export function tableById(scene: SchemaScene, id: string): LabTable | undefined {
  return scene.tables.find((t) => t.id === id);
}

export function columnValues(table: LabTable, column: string): (string | number | null)[] {
  const index = table.columns.findIndex((c) => c.name === column);
  if (index < 0) return [];
  return table.rows.map((row) => row[index] ?? null);
}

export function isUnique(values: unknown[]): boolean {
  return new Set(values.map((v) => JSON.stringify(v))).size === values.length;
}

/** Cardinality implied by the data, oriented from → to. */
export function detectCardinality(fromValues: unknown[], toValues: unknown[]): Cardinality {
  const fromUnique = isUnique(fromValues);
  const toUnique = isUnique(toValues);
  if (fromUnique && toUnique) return 'one-to-one';
  if (!fromUnique && toUnique) return 'many-to-one';
  if (fromUnique && !toUnique) return 'one-to-many';
  return 'many-to-many';
}

export const CARDINALITY_LABEL: Record<Cardinality, string> = {
  'many-to-one': 'Many to one (*:1)',
  'one-to-many': 'One to many (1:*)',
  'one-to-one': 'One to one (1:1)',
  'many-to-many': 'Many to many (*:*)',
};

const refLabel = (r: ColumnRef) => `${r.table}.${r.column}`;
const sameRef = (a: ColumnRef, b: ColumnRef) => a.table === b.table && a.column === b.column;

// ---- Interaction state ----

export interface LabState {
  model: LabModel;
  pending: ColumnRef | null; // first column chosen in click-to-connect
  message: string | null; // status line for the learner (also announced)
  nextId: number;
}

export type LabAction =
  | { type: 'add'; table: string }
  | { type: 'remove'; table: string }
  | { type: 'move'; table: string; x: number; y: number }
  | { type: 'nudge'; table: string; dx: number; dy: number }
  | { type: 'select-column'; ref: ColumnRef }
  | { type: 'cancel' }
  | { type: 'remove-relationship'; id: string }
  | { type: 'set-cardinality'; id: string; value: Cardinality | null }
  | { type: 'set-direction'; id: string; value: FilterDirection }
  | { type: 'set-fact'; table: string | null }
  | { type: 'reset' }
  | { type: 'load'; model: LabModel };

/** Starting positions (fractions of the workspace): a star around the centre. */
const SLOTS = [
  { x: 0.5, y: 0.5 },
  { x: 0.16, y: 0.2 },
  { x: 0.84, y: 0.2 },
  { x: 0.16, y: 0.8 },
  { x: 0.84, y: 0.8 },
  { x: 0.5, y: 0.12 },
  { x: 0.5, y: 0.88 },
];

export function emptyModel(): LabModel {
  return { placed: [], relationships: [], factTable: null };
}

export function initialLabState(model: LabModel = emptyModel()): LabState {
  const max = model.relationships.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, '')) || 0), 0);
  return { model, pending: null, message: null, nextId: max + 1 };
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function freeSlot(placed: LabModel['placed']) {
  return SLOTS.find((s) => !placed.some((p) => Math.abs(p.x - s.x) < 0.05 && Math.abs(p.y - s.y) < 0.05)) ?? { x: 0.5, y: 0.5 };
}

export function labReducer(scene: SchemaScene, state: LabState, action: LabAction): LabState {
  const { model } = state;
  switch (action.type) {
    case 'add': {
      if (!tableById(scene, action.table) || model.placed.some((p) => p.table === action.table)) return state;
      const slot = freeSlot(model.placed);
      return { ...state, model: { ...model, placed: [...model.placed, { table: action.table, ...slot }] }, message: `${action.table} added to the model.` };
    }
    case 'remove': {
      if (!model.placed.some((p) => p.table === action.table)) return state;
      const relationships = model.relationships.filter((r) => r.from.table !== action.table && r.to.table !== action.table);
      const removed = model.relationships.length - relationships.length;
      return {
        ...state,
        pending: state.pending?.table === action.table ? null : state.pending,
        model: {
          placed: model.placed.filter((p) => p.table !== action.table),
          relationships,
          factTable: model.factTable === action.table ? null : model.factTable,
        },
        message: `${action.table} removed${removed ? ` with ${removed} relationship${removed === 1 ? '' : 's'}` : ''}.`,
      };
    }
    case 'move':
    case 'nudge': {
      const placed = model.placed.map((p) => {
        if (p.table !== action.table) return p;
        return action.type === 'move'
          ? { ...p, x: clamp01(action.x), y: clamp01(action.y) }
          : { ...p, x: clamp01(p.x + action.dx), y: clamp01(p.y + action.dy) };
      });
      return { ...state, model: { ...model, placed } };
    }
    case 'select-column': {
      const ref = action.ref;
      const table = tableById(scene, ref.table);
      if (!table || !table.columns.some((c) => c.name === ref.column) || !model.placed.some((p) => p.table === ref.table)) return state;
      const pending = state.pending;
      if (!pending) {
        return { ...state, pending: ref, message: `${refLabel(ref)} selected. Now choose the matching column in another table.` };
      }
      if (sameRef(pending, ref)) return { ...state, pending: null, message: 'Connection cancelled.' };
      if (pending.table === ref.table) {
        return { ...state, pending: ref, message: `${refLabel(ref)} selected instead. A relationship joins two different tables.` };
      }
      const duplicate = model.relationships.some((r) => (sameRef(r.from, pending) && sameRef(r.to, ref)) || (sameRef(r.from, ref) && sameRef(r.to, pending)));
      if (duplicate) return { ...state, pending: null, message: `${refLabel(pending)} and ${refLabel(ref)} are already connected.` };
      const relationship: LabRelationship = { id: `r${state.nextId}`, from: pending, to: ref, cardinality: null, direction: 'single' };
      return {
        ...state,
        pending: null,
        nextId: state.nextId + 1,
        model: { ...model, relationships: [...model.relationships, relationship] },
        message: `Connected ${refLabel(pending)} to ${refLabel(ref)}. Now choose its cardinality.`,
      };
    }
    case 'cancel':
      return state.pending ? { ...state, pending: null, message: 'Connection cancelled.' } : state;
    case 'remove-relationship': {
      const rel = model.relationships.find((r) => r.id === action.id);
      if (!rel) return state;
      return { ...state, model: { ...model, relationships: model.relationships.filter((r) => r.id !== action.id) }, message: `Removed the relationship ${refLabel(rel.from)} – ${refLabel(rel.to)}.` };
    }
    case 'set-cardinality':
    case 'set-direction': {
      const relationships = model.relationships.map((r) => {
        if (r.id !== action.id) return r;
        return action.type === 'set-cardinality' ? { ...r, cardinality: action.value } : { ...r, direction: action.value };
      });
      return { ...state, model: { ...model, relationships } };
    }
    case 'set-fact':
      if (action.table && !model.placed.some((p) => p.table === action.table)) return state;
      return { ...state, model: { ...model, factTable: action.table } };
    case 'reset':
      return { ...initialLabState(), message: 'The model was reset.' };
    case 'load':
      return initialLabState(action.model);
    default:
      return state;
  }
}

/** The intended model, laid out as a star. */
export function solutionModel(scene: SchemaScene): LabModel {
  const order = [scene.factTable, ...scene.solution.tables.filter((t) => t !== scene.factTable)];
  return {
    placed: order.map((table, i) => ({ table, ...SLOTS[i % SLOTS.length] })),
    relationships: scene.solution.relationships.map((r, i) => ({ id: `r${i + 1}`, ...r })),
    factTable: scene.factTable,
  };
}

// ---- Validation ----

export type Severity = 'error' | 'warning';

export interface LabIssue {
  id: string;
  rule: string; // stable rule id, e.g. "unique-dimension-key"
  severity: Severity;
  title: string;
  text: string; // why it matters / how to fix it
}

export interface LabCheck { rule: string; label: string; passed: boolean; detail: string }

export interface LabValidation {
  correct: boolean; // no errors (warnings allowed)
  issues: LabIssue[];
  checks: LabCheck[];
}

/** Normalise a relationship so the "one" (dimension) side is `one`. */
function orient(scene: SchemaScene, rel: LabRelationship) {
  const fromTable = tableById(scene, rel.from.table)!;
  const toTable = tableById(scene, rel.to.table)!;
  const fromValues = columnValues(fromTable, rel.from.column);
  const toValues = columnValues(toTable, rel.to.column);
  const detected = detectCardinality(fromValues, toValues);
  return { fromTable, toTable, fromValues, toValues, detected };
}

export function validateModel(scene: SchemaScene, model: LabModel): LabValidation {
  const issues: LabIssue[] = [];
  const checks: LabCheck[] = [];
  const placed = new Set(model.placed.map((p) => p.table));
  const add = (issue: LabIssue) => issues.push(issue);

  // 1. Expected tables present.
  const missing = scene.requiredTables.filter((t) => !placed.has(t));
  for (const t of missing) {
    add({ id: `missing-${t}`, rule: 'required-tables', severity: 'error', title: `${t} is missing`, text: `Add ${t} to the model. ${tableById(scene, t)?.description ?? ''}`.trim() });
  }
  checks.push({ rule: 'required-tables', label: 'The four star-schema tables are in the model', passed: !missing.length, detail: missing.length ? `Missing: ${missing.join(', ')}` : scene.requiredTables.join(', ') });

  // 2. Fact table chosen and at transaction-level grain.
  const fact = model.factTable ? tableById(scene, model.factTable) : undefined;
  if (!fact) {
    add({ id: 'no-fact', rule: 'fact-grain', severity: 'error', title: 'No fact table chosen', text: 'Mark which table records the sales transactions. That is the fact table at the centre of the star.' });
  } else if (fact.grainLevel !== 'transaction') {
    add({ id: 'wrong-fact', rule: 'fact-grain', severity: 'error', title: `${fact.id} can’t be the fact table`, text: `Its grain is "${fact.grain}". ${fact.grainLevel === 'aggregated' ? 'It is already summarised, so the detail needed to analyse revenue by product, date and country has been lost.' : 'It describes things (a lookup), rather than recording events.'} Choose the table with one row per transaction.` });
  } else {
    const idColumn = fact.columns.find((c) => c.key === 'pk');
    const idUnique = idColumn ? isUnique(columnValues(fact, idColumn.name)) : false;
    if (!idUnique) add({ id: 'fact-id', rule: 'fact-grain', severity: 'error', title: `${fact.id} has repeated row IDs`, text: 'Each transaction should appear once.' });
  }
  checks.push({
    rule: 'fact-grain',
    label: 'The fact table holds one row per transaction',
    passed: Boolean(fact && fact.grainLevel === 'transaction'),
    detail: fact ? `${fact.id}: ${fact.grain}` : 'No fact table chosen',
  });

  // 3. Extra tables.
  for (const t of placed) {
    if (scene.requiredTables.includes(t)) continue;
    const used = model.relationships.some((r) => r.from.table === t || r.to.table === t);
    if (!used) {
      add({ id: `extra-${t}`, rule: 'extra-table', severity: 'warning', title: `${t} isn’t needed`, text: `${tableById(scene, t)?.description ?? ''} You can remove it to keep the model clear.`.trim() });
    }
  }

  // 4–9. Each relationship.
  const factId = scene.factTable;
  const validLinks = new Map<string, number>(); // dimension → count of valid links to the fact table
  const pairCounts = new Map<string, number>();
  let keyFieldsOk = true;
  let uniqueOk = true;
  let matchOk = true;
  let cardinalityOk = true;
  let directionOk = true;
  const keyDetails: string[] = [];
  const matchDetails: string[] = [];

  for (const rel of model.relationships) {
    const label = `${refLabel(rel.from)} – ${refLabel(rel.to)}`;
    const { fromTable, toTable, fromValues, toValues, detected } = orient(scene, rel);
    const pairKey = [rel.from.table, rel.to.table].sort().join('|');
    pairCounts.set(pairKey, (pairCounts.get(pairKey) ?? 0) + 1);
    let relOk = true;

    // Key fields only.
    const fromCol = fromTable.columns.find((c) => c.name === rel.from.column)!;
    const toCol = toTable.columns.find((c) => c.name === rel.to.column)!;
    const notKeys = [fromCol.key ? null : refLabel(rel.from), toCol.key ? null : refLabel(rel.to)].filter(Boolean);
    if (notKeys.length) {
      keyFieldsOk = false;
      relOk = false;
      add({ id: `${rel.id}-keys`, rule: 'key-fields', severity: 'error', title: `${label} doesn’t use key fields`, text: `${notKeys.join(' and ')} ${notKeys.length > 1 ? 'are' : 'is'} a measurement or description, not a key. Relationships join an ID in one table to the same ID in another.` });
    }

    // Unique key on the "one" side.
    if (detected === 'many-to-many') {
      uniqueOk = false;
      relOk = false;
      const dup = [fromTable, toTable].find((t) => t.id !== factId) ?? toTable;
      const dupCol = dup.id === fromTable.id ? rel.from.column : rel.to.column;
      add({ id: `${rel.id}-m2m`, rule: 'unique-dimension-key', severity: 'error', title: `${label} is accidentally many-to-many`, text: `Values repeat on both sides. In ${dup.id}, ${dupCol} isn’t unique, so one sale could match several rows and totals would be counted twice. A dimension’s key must identify exactly one row.` });
    } else if (detected === 'one-to-one') {
      relOk = false;
      add({ id: `${rel.id}-11`, rule: 'grain-match', severity: 'error', title: `${label} links two unique columns`, text: 'Both columns have only unique values, so this isn’t a fact-to-dimension link. A fact table’s foreign key repeats (many sales per product); the dimension’s key is unique.' });
    } else {
      const oneSide = detected === 'many-to-one' ? { table: toTable, col: rel.to.column, values: toValues } : { table: fromTable, col: rel.from.column, values: fromValues };
      keyDetails.push(`${oneSide.table.id}.${oneSide.col}: ${new Set(oneSide.values.map(String)).size} unique values`);
    }

    // Foreign-key values must find a match.
    if (detected === 'many-to-one' || detected === 'one-to-many') {
      const many = detected === 'many-to-one' ? { ref: rel.from, values: fromValues } : { ref: rel.to, values: toValues };
      const one = detected === 'many-to-one' ? { ref: rel.to, values: toValues } : { ref: rel.from, values: fromValues };
      const lookup = new Set(one.values.map((v) => JSON.stringify(v)));
      const unmatched = many.values.filter((v) => !lookup.has(JSON.stringify(v)));
      if (unmatched.length) {
        matchOk = false;
        relOk = false;
        add({ id: `${rel.id}-match`, rule: 'keys-match', severity: 'error', title: `${label}: values don’t match`, text: `${unmatched.length} of ${many.values.length} values in ${refLabel(many.ref)} have no match in ${refLabel(one.ref)} (for example ${String(unmatched[0])}). These columns don’t hold the same kind of ID.` });
      } else {
        matchDetails.push(`All ${many.values.length} values in ${refLabel(many.ref)} match ${refLabel(one.ref)}`);
      }
    }

    // Star shape: fact (many side) to dimension (one side).
    const tables = [rel.from.table, rel.to.table];
    const touchesFact = tables.includes(factId);
    if (!touchesFact) {
      relOk = false;
      add({ id: `${rel.id}-shape`, rule: 'star-shape', severity: 'error', title: `${label} connects two non-fact tables`, text: `In a star schema each dimension connects only to the fact table (${factId}). Extra links between dimensions create more than one filter path, which makes results ambiguous.` });
    } else if ((detected === 'many-to-one' && rel.to.table === factId) || (detected === 'one-to-many' && rel.from.table === factId)) {
      relOk = false;
      add({ id: `${rel.id}-side`, rule: 'star-shape', severity: 'error', title: `${label} has the fact table on the “one” side`, text: 'The fact table should be the “many” side: many sales share one product, date or country.' });
    }

    // Cardinality chosen by the learner must match the data.
    if (!rel.cardinality) {
      cardinalityOk = false;
      relOk = false;
      add({ id: `${rel.id}-card-unset`, rule: 'cardinality', severity: 'error', title: `${label}: choose a cardinality`, text: 'Look at the sample rows: do the values repeat on one side, both sides, or neither?' });
    } else if (rel.cardinality !== detected) {
      cardinalityOk = false;
      relOk = false;
      add({ id: `${rel.id}-card`, rule: 'cardinality', severity: 'error', title: `${label}: cardinality doesn’t fit the data`, text: `You chose ${CARDINALITY_LABEL[rel.cardinality]}, but in the data ${detected === 'many-to-one' ? `${refLabel(rel.from)} repeats while ${refLabel(rel.to)} is unique` : detected === 'one-to-many' ? `${refLabel(rel.from)} is unique while ${refLabel(rel.to)} repeats` : detected === 'many-to-many' ? 'values repeat on both sides' : 'both sides are unique'}, which is ${CARDINALITY_LABEL[detected]}.` });
    }

    // Filter direction.
    if (rel.direction === 'both') {
      directionOk = false;
      relOk = false;
      add({ id: `${rel.id}-dir`, rule: 'direction', severity: 'error', title: `${label}: use a single filter direction`, text: 'With “both”, the fact table can filter the dimension too, which can create ambiguous paths between tables. In a star schema, filters flow one way: from each dimension to the fact table.' });
    }

    if (relOk && touchesFact) {
      const dim = tables.find((t) => t !== factId)!;
      validLinks.set(dim, (validLinks.get(dim) ?? 0) + 1);
    }
  }

  // Ambiguity: more than one relationship between the same two tables.
  for (const [pair, count] of pairCounts) {
    if (count > 1) {
      const [a, b] = pair.split('|');
      add({ id: `dup-${pair}`, rule: 'ambiguous', severity: 'error', title: `${a} and ${b} are joined ${count} times`, text: 'Two relationships between the same tables make it unclear which one should filter. Keep one: the one that joins matching keys.' });
    }
  }

  // Every dimension reachable from the fact table.
  for (const dim of scene.dimensions) {
    if (!placed.has(dim)) continue; // already reported as missing
    if (!validLinks.has(dim) && !model.relationships.some((r) => [r.from.table, r.to.table].includes(dim) && [r.from.table, r.to.table].includes(factId))) {
      add({ id: `unlinked-${dim}`, rule: 'connected', severity: 'error', title: `${dim} isn’t connected to ${factId}`, text: `Without a relationship, revenue can’t be filtered by ${dim.replace(/^Dim/, '').toLowerCase()}.` });
    }
  }

  const allConnected = scene.dimensions.every((d) => validLinks.has(d));
  checks.push(
    { rule: 'key-fields', label: 'Relationships join key fields', passed: keyFieldsOk && model.relationships.length > 0, detail: 'Foreign keys in the fact table join primary keys in the dimensions' },
    { rule: 'unique-dimension-key', label: 'Each dimension key is unique', passed: uniqueOk && keyDetails.length > 0, detail: keyDetails.join('; ') || 'No valid relationships yet' },
    { rule: 'keys-match', label: 'Every foreign key finds its match', passed: matchOk && matchDetails.length > 0, detail: matchDetails.join('; ') || 'No valid relationships yet' },
    { rule: 'cardinality', label: 'Cardinality matches the data (many sales → one dimension row)', passed: cardinalityOk && model.relationships.length > 0, detail: 'Many-to-one from the fact table to each dimension' },
    { rule: 'direction', label: 'Filters flow one way, from dimension to fact', passed: directionOk && model.relationships.length > 0, detail: 'Single direction on every relationship' },
    { rule: 'connected', label: 'Every dimension connects to the fact table, and only to it', passed: allConnected && !issues.some((i) => i.rule === 'star-shape' || i.rule === 'ambiguous'), detail: scene.dimensions.join(', ') },
  );

  return { correct: !issues.some((i) => i.severity === 'error'), issues, checks };
}

/** Sanitise a model coming from saved state or the UI. */
export function cleanModel(scene: SchemaScene, raw: unknown): LabModel {
  const m = raw as Partial<LabModel> | null;
  if (!m || typeof m !== 'object') return emptyModel();
  const ids = new Set(scene.tables.map((t) => t.id));
  const hasColumn = (r: ColumnRef) => ids.has(r.table) && Boolean(tableById(scene, r.table)?.columns.some((c) => c.name === r.column));
  const placed = (Array.isArray(m.placed) ? m.placed : [])
    .filter((p) => p && ids.has(p.table) && Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ table: p.table, x: clamp01(p.x), y: clamp01(p.y) }))
    .filter((p, i, list) => list.findIndex((q) => q.table === p.table) === i);
  const placedIds = new Set(placed.map((p) => p.table));
  const relationships = (Array.isArray(m.relationships) ? m.relationships : [])
    .filter((r) => r && hasColumn(r.from) && hasColumn(r.to) && placedIds.has(r.from.table) && placedIds.has(r.to.table) && r.from.table !== r.to.table)
    .map((r, i) => ({
      id: typeof r.id === 'string' ? r.id : `r${i + 1}`,
      from: { table: r.from.table, column: r.from.column },
      to: { table: r.to.table, column: r.to.column },
      cardinality: (['many-to-one', 'one-to-many', 'one-to-one', 'many-to-many'] as const).includes(r.cardinality as Cardinality) ? r.cardinality : null,
      direction: r.direction === 'both' ? 'both' as const : 'single' as const,
    }));
  return { placed, relationships, factTable: m.factTable && placedIds.has(m.factTable) ? m.factTable : null };
}
