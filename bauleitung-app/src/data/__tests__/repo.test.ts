import { MemoryStore } from '../RecordStore';
import { Repo } from '../repo';
import type { Projekt } from '../../domain/types';

function setup() {
  const store = new MemoryStore();
  let n = 0;
  let autor = 'Diego';
  const repo = new Repo(store, () => autor, () => `id${++n}`);
  return { store, repo, setAutor: (a: string) => (autor = a) };
}

const daten = { nr: '1', name: 'Test', bauherr: 'BH', adresse: '', kiErlaubt: false };

describe('Repo', () => {
  it('legt Datensätze mit Ersteller, Zeit und Version 1 an und merkt sie zum Abgleich vor', async () => {
    const { store, repo } = setup();
    const p = await repo.neu<Projekt>('projekt', null, daten);
    expect(p).toMatchObject({ id: 'id1', projektId: 'id1', typ: 'projekt', erstelltVon: 'Diego', version: 1, geloescht: false });
    expect((await store.ungesynct()).map((r) => r.id)).toEqual(['id1']);
  });

  it('erhöht bei Änderungen die Version und setzt den Bearbeiter', async () => {
    const { repo, setAutor } = setup();
    const p = await repo.neu<Projekt>('projekt', null, daten);
    setAutor('Kollege');
    const p2 = await repo.aendere(p, { name: 'Neu' });
    expect(p2).toMatchObject({ name: 'Neu', version: 2, erstelltVon: 'Diego', geaendertVon: 'Kollege' });
  });

  it('löscht nur durch Markieren (für den Abgleich) und blendet Gelöschtes aus', async () => {
    const { store, repo } = setup();
    const p = await repo.neu<Projekt>('projekt', null, daten);
    await repo.loesche(p);
    expect(await repo.alle('projekt')).toHaveLength(0);
    expect((await store.hole<Projekt>(p.id))?.geloescht).toBe(true);
  });

  it('markiert nur die hochgeladene Version als abgeglichen', async () => {
    const { store, repo } = setup();
    const p = await repo.neu<Projekt>('projekt', null, daten);
    await repo.aendere(p, { name: 'Neu' }); // Version 2
    await store.alsSynctMarkieren(p.id, 1); // Upload von Version 1 fertig → bleibt offen
    expect(await store.ungesynct()).toHaveLength(1);
    await store.alsSynctMarkieren(p.id, 2);
    expect(await store.ungesynct()).toHaveLength(0);
  });
});
