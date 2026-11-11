import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { bezeichnung, suche, SUCH_TYPEN, suchtext, TYP_NAME, type Treffer } from '../domain/suche';
import type { BaseRecord, Bautag, ProtokollPunkt, RecordTyp } from '../domain/types';
import { holeRepo, useAktivesProjekt, useApp } from '../state/useApp';
import { Abschnitt, Feld, Leer, SchalterZeile, Seite, Zeile, type IconName } from '../ui/bausteine';
import { Titel } from '../ui/Rahmen';
import { farbe, groesse } from '../ui/theme';

const ICON: Partial<Record<RecordTyp, IconName>> = {
  board: 'view-dashboard',
  protokollpunkt: 'clipboard-text',
  foto: 'camera',
  mangel: 'alert-octagon-outline',
  bautag: 'notebook-edit',
  lieferschein: 'truck-delivery',
  firma: 'account-hard-hat',
};

function oeffne(t: Treffer) {
  const id = t.rec.id;
  switch (t.typ) {
    case 'board':
      return router.push({ pathname: '/board/[id]', params: { id } });
    case 'protokollpunkt':
      return router.push({ pathname: '/jourfixe/[id]', params: { id: (t.rec as ProtokollPunkt).protokollId } });
    case 'foto':
      return router.push({ pathname: '/fotos/[id]', params: { id } });
    case 'mangel':
      return router.push({ pathname: '/maengel/[id]', params: { id } });
    case 'bautag':
      return router.push({ pathname: '/bautagebuch/[datum]', params: { datum: (t.rec as Bautag).datum } });
    case 'lieferschein':
      return router.push({ pathname: '/lieferscheine/[id]', params: { id } });
    case 'firma':
      return router.push({ pathname: '/firmen/[id]', params: { id } });
  }
}

/** Suche über alle Bereiche – läuft nur auf dem Gerät, nichts wird übertragen. */
export default function SucheScreen() {
  const projekt = useAktivesProjekt();
  const projekte = useApp((s) => s.projekte);
  const projektWaehlen = useApp((s) => s.projektWaehlen);
  const stand = useApp((s) => s.datenStand);
  const [frage, setFrage] = useState('');
  const [alle, setAlle] = useState(false);
  const [daten, setDaten] = useState<BaseRecord[]>([]);

  useEffect(() => {
    let aktiv = true;
    (async () => {
      const repo = holeRepo();
      const listen = await Promise.all(SUCH_TYPEN.map((t) => repo.alle<BaseRecord>(t, alle ? undefined : (projekt?.id ?? 'x'))));
      if (aktiv) setDaten(listen.flat());
    })();
    return () => {
      aktiv = false;
    };
  }, [alle, projekt?.id, stand]);

  const treffer = useMemo(() => suche(daten, frage), [daten, frage]);
  const gruppen = SUCH_TYPEN.map((typ) => ({ typ, liste: treffer.filter((t) => t.typ === typ) })).filter((g) => g.liste.length);

  return (
    <Seite>
      <Titel text="Suche" zurueckZu="/mehr" />
      <Feld label="Suchbegriff" value={frage} onChangeText={setFrage} placeholder="z. B. Estrich, Brandschutz, Firma …" autoFocus autoCapitalize="none" testID="suche-feld" />
      <SchalterZeile label="In allen Projekten suchen" wert={alle} onChange={setAlle} testID="suche-alle" />
      {frage.trim() ? (
        <Text style={{ fontSize: groesse.schriftKlein + 1, fontWeight: '700', color: farbe.textLeise }} testID="suche-anzahl">
          {treffer.length} Treffer
        </Text>
      ) : (
        <Leer icon="magnify" text="Durchsucht Board, Jour Fixe, Fotos, Mängel, Bautagebuch, Lieferscheine und Firmen. Die Suche läuft nur auf deinem Gerät." />
      )}
      {gruppen.map((g) => (
        <Abschnitt key={g.typ} titel={`${TYP_NAME[g.typ]} (${g.liste.length})`}>
          {g.liste.slice(0, 30).map((t) => {
            const anderes = t.rec.projektId !== projekt?.id ? projekte.find((p) => p.id === t.rec.projektId) : null;
            const text = suchtext(t.rec);
            return (
              <Zeile
                key={t.rec.id}
                testID="treffer"
                icon={ICON[t.typ]}
                titel={bezeichnung(t.rec)}
                untertitel={[anderes ? `Projekt ${anderes.nr} ${anderes.name}` : null, text.length > 110 ? `${text.slice(0, 110)}…` : text].filter(Boolean).join(' · ')}
                onPress={async () => {
                  if (anderes) await projektWaehlen(anderes.id);
                  oeffne(t);
                }}
              />
            );
          })}
          {g.liste.length > 30 ? <View><Text style={{ color: farbe.textLeise }}>… weitere {g.liste.length - 30} Treffer – Suche verfeinern</Text></View> : null}
        </Abschnitt>
      ))}
    </Seite>
  );
}
