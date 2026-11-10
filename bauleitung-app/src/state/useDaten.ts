import { useEffect, useState } from 'react';
import type { BaseRecord, RecordTyp } from '../domain/types';
import { holeRepo, useApp } from './useApp';

/** Als projektId übergeben: Datensätze aller Projekte laden. */
export const ALLE_PROJEKTE = '*';

/** Lädt alle Datensätze eines Typs im Projekt und lädt neu, sobald sich Daten ändern. */
export function useDaten<T extends BaseRecord>(typ: RecordTyp, projektId: string | undefined): T[] | null {
  const stand = useApp((s) => s.datenStand);
  const [daten, setDaten] = useState<T[] | null>(null);
  useEffect(() => {
    let aktiv = true;
    if (!projektId) {
      setDaten([]);
      return;
    }
    holeRepo()
      .alle<T>(typ, projektId === ALLE_PROJEKTE ? undefined : projektId)
      .then((d) => aktiv && setDaten(d));
    return () => {
      aktiv = false;
    };
  }, [typ, projektId, stand]);
  return daten;
}

/** Lädt einen Datensatz und lädt neu, sobald sich Daten ändern. undefined = lädt, null = nicht gefunden. */
export function useDatensatz<T extends BaseRecord>(id: string | undefined): T | null | undefined {
  const stand = useApp((s) => s.datenStand);
  const [rec, setRec] = useState<T | null | undefined>(undefined);
  useEffect(() => {
    let aktiv = true;
    if (!id) {
      setRec(null);
      return;
    }
    holeRepo()
      .hole<T>(id)
      .then((r) => aktiv && setRec(r && !r.geloescht ? r : null));
    return () => {
      aktiv = false;
    };
  }, [id, stand]);
  return rec;
}
