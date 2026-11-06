import { MemoryStore } from '../RecordStore';
import { useApp } from '../../state/useApp';

describe('App-Zustand: Projekte', () => {
  it('legt Projekte an, wählt das erste automatisch und kann umschalten', async () => {
    const store = new MemoryStore();
    await useApp.getState().init(store);
    const a = await useApp.getState().projektSpeichern({ nr: '2', name: 'B', bauherr: '', adresse: '', kiErlaubt: false });
    expect(useApp.getState().aktivesProjektId).toBe(a.id);
    const b = await useApp.getState().projektSpeichern({ nr: '1', name: 'A', bauherr: '', adresse: '', kiErlaubt: true });
    expect(useApp.getState().projekte.map((p) => p.nr)).toEqual(['1', '2']);
    await useApp.getState().projektWaehlen(a.id);
    expect(await store.holeMeta('aktivesProjekt')).toBe(a.id);
    await useApp.getState().projektLoeschen(a.id);
    expect(useApp.getState().aktivesProjektId).toBe(b.id);
  });
});
