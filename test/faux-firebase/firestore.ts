// Faux Firestore en memoire (banc d'essai uniquement).
type Donnees = Record<string, unknown>;
const base = new Map<string, Donnees>();
(window as unknown as { __base: typeof base }).__base = base;

export class Timestamp {
  constructor(public readonly ms: number) {}
  static now() { return new Timestamp(Date.now()); }
  static fromDate(d: Date) { return new Timestamp(d.getTime()); }
  toDate() { return new Date(this.ms); }
  valueOf() { return this.ms; }
}
const SERVEUR = { __serveur: true };
class Increment { constructor(public n: number) {} }
export const serverTimestamp = () => SERVEUR;
export const increment = (n: number) => new Increment(n);
const DOC_ID = { __docId: true };
export const documentId = () => DOC_ID;

export type Firestore = { faux: true };
export const initializeFirestore = (): Firestore => ({ faux: true });
export const persistentLocalCache = (o?: unknown) => o;
export const persistentMultipleTabManager = () => ({});

interface RefCol { type: 'col'; path: string }
interface RefDoc { type: 'doc'; path: string; id: string }
let compteur = 0;
const autoId = () => `id${Date.now().toString(36)}${(compteur++).toString(36)}`;

export function collection(_db: unknown, ...parties: string[]): RefCol {
  const p = typeof _db === 'object' && _db && 'type' in (_db as object) ? [(_db as RefDoc).path, ...parties] : parties;
  return { type: 'col', path: p.join('/') };
}
export function doc(a: unknown, ...parties: string[]): RefDoc {
  let path: string;
  if ((a as RefCol)?.type === 'col') path = [(a as RefCol).path, parties[0] ?? autoId()].join('/');
  else path = parties.join('/');
  return { type: 'doc', path, id: path.split('/').pop() as string };
}

export class DocumentSnapshot {
  constructor(public ref: RefDoc, private d: Donnees | undefined) {}
  get id() { return this.ref.id; }
  exists() { return this.d !== undefined; }
  data() { return this.d ? structuredCloneSafe(this.d) : undefined; }
}
function structuredCloneSafe(d: Donnees): Donnees {
  const o: Donnees = {};
  for (const [k, v] of Object.entries(d)) o[k] = v instanceof Timestamp ? v : Array.isArray(v) ? v.map((x) => (typeof x === 'object' && x ? { ...x } : x)) : typeof v === 'object' && v ? JSON.parse(JSON.stringify(v)) : v;
  return o;
}

function resoudre(d: Donnees, ancien?: Donnees): Donnees {
  const o: Donnees = { ...(ancien ?? {}) };
  for (const [k, v] of Object.entries(d)) {
    if (v === SERVEUR) o[k] = Timestamp.now();
    else if (v instanceof Increment) o[k] = Number(o[k] ?? 0) + v.n;
    else o[k] = v;
  }
  return o;
}
const lent = () => new Promise((r) => setTimeout(r, 15));

export async function getDoc(r: RefDoc) { await lent(); return new DocumentSnapshot(r, base.get(r.path)); }
export async function setDoc(r: RefDoc, d: Donnees) { await lent(); base.set(r.path, resoudre(d)); }
export async function addDoc(c: RefCol, d: Donnees) { const r = doc(c); await setDoc(r, d); return r; }
export async function updateDoc(r: RefDoc, d: Donnees) {
  await lent();
  const a = base.get(r.path);
  if (!a) throw Object.assign(new Error('not found'), { code: 'not-found' });
  base.set(r.path, resoudre(d, a));
}
export async function deleteDoc(r: RefDoc) { await lent(); base.delete(r.path); }

export function writeBatch() {
  const ops: (() => void)[] = [];
  return {
    set(r: RefDoc, d: Donnees) { ops.push(() => base.set(r.path, resoudre(d))); },
    update(r: RefDoc, d: Donnees) { ops.push(() => base.set(r.path, resoudre(d, base.get(r.path)))); },
    delete(r: RefDoc) { ops.push(() => base.delete(r.path)); },
    async commit() { await lent(); ops.forEach((o) => o()); },
  };
}

type Contrainte =
  | { k: 'where'; champ: unknown; op: string; v: unknown }
  | { k: 'orderBy'; champ: unknown; dir: string }
  | { k: 'limit'; n: number }
  | { k: 'startAfter'; s: DocumentSnapshot };
export type QueryConstraint = Contrainte;
export const where = (champ: unknown, op: string, v: unknown): Contrainte => ({ k: 'where', champ, op, v });
export const orderBy = (champ: unknown, dir = 'asc'): Contrainte => ({ k: 'orderBy', champ, dir });
export const limit = (n: number): Contrainte => ({ k: 'limit', n });
export const startAfter = (s: DocumentSnapshot): Contrainte => ({ k: 'startAfter', s });
interface Requete { col: RefCol; c: Contrainte[] }
export const query = (col: RefCol, ...c: Contrainte[]): Requete => ({ col, c });

function valeur(path: string, d: Donnees, champ: unknown): unknown {
  if (champ === DOC_ID) return path.split('/').pop();
  const v = d[champ as string];
  return v instanceof Timestamp ? v.ms : v;
}
function cmp(a: unknown, b: unknown) { return a === b ? 0 : (a as number) < (b as number) ? -1 : 1; }

export async function getDocs(q: Requete | RefCol) {
  await lent();
  const r: Requete = 'type' in q ? { col: q, c: [] } : q;
  const prefixe = r.col.path + '/';
  let lignes = [...base.entries()].filter(([p]) => p.startsWith(prefixe) && !p.slice(prefixe.length).includes('/'));
  for (const c of r.c) {
    if (c.k !== 'where') continue;
    const v = c.v instanceof Timestamp ? c.v.ms : c.v;
    lignes = lignes.filter(([p, d]) => {
      const x = valeur(p, d, c.champ);
      if (x === undefined) return false;
      switch (c.op) {
        case '==': return x === v;
        case '>=': return cmp(x, v) >= 0;
        case '<': return cmp(x, v) < 0;
        case 'in': return (v as unknown[]).includes(x);
        default: throw new Error('op ' + c.op);
      }
    });
  }
  const tris = r.c.filter((c): c is Extract<Contrainte, { k: 'orderBy' }> => c.k === 'orderBy');
  for (const t of tris) lignes = lignes.filter(([p, d]) => valeur(p, d, t.champ) !== undefined);
  lignes.sort((a, b) => {
    for (const t of tris) {
      const x = cmp(valeur(a[0], a[1], t.champ), valeur(b[0], b[1], t.champ));
      if (x) return t.dir === 'desc' ? -x : x;
    }
    return cmp(a[0], b[0]);
  });
  const apres = r.c.find((c): c is Extract<Contrainte, { k: 'startAfter' }> => c.k === 'startAfter');
  if (apres) {
    const i = lignes.findIndex(([p]) => p === apres.s.ref.path);
    lignes = lignes.slice(i + 1);
  }
  const lim = r.c.find((c): c is Extract<Contrainte, { k: 'limit' }> => c.k === 'limit');
  if (lim) lignes = lignes.slice(0, lim.n);
  const docs = lignes.map(([p, d]) => new DocumentSnapshot({ type: 'doc', path: p, id: p.split('/').pop() as string }, d));
  return { docs, empty: docs.length === 0 };
}
export async function getCountFromServer(q: Requete | RefCol) {
  const r = await getDocs(q);
  return { data: () => ({ count: r.docs.length }) };
}
