import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { datumDe } from '../../domain/datum';
import type { Lieferschein } from '../../domain/types';
import { lieferscheinAusBild } from '../../dienste/lieferscheine';
import { bildWaehlen, fotoAufnehmen, kameraVerfuegbar, kiBild } from '../../foto/aufnahme';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Badge, Knopf, Leer, Reihe, Seite, Text2, Zeile } from '../../ui/bausteine';
import { MitProjekt, Titel } from '../../ui/Rahmen';
import { farbe } from '../../ui/theme';
import { toast } from '../../ui/toast';

export default function LieferscheineScreen() {
  return (
    <>
      <Titel text="Lieferscheine" />
      <MitProjekt>
        <Liste />
      </MitProjekt>
    </>
  );
}

function Liste() {
  const projekt = useAktivesProjekt()!;
  const geaendert = useApp((s) => s.geaendert);
  const kiEinst = useApp((s) => s.kiEinst);
  const scheine = useDaten<Lieferschein>('lieferschein', projekt.id);
  const [laeuft, setLaeuft] = useState(false);
  if (!scheine) return null;
  const sortiert = [...scheine].sort((a, b) => (b.datum || b.erstelltAm).localeCompare(a.datum || a.erstelltAm));

  async function neu(quelle: 'kamera' | 'datei') {
    try {
      setLaeuft(true);
      const bild = quelle === 'kamera' ? await fotoAufnehmen() : await bildWaehlen();
      if (!bild) return;
      const r = await lieferscheinAusBild({ repo: holeRepo(), projekt, bild, kiEinst, bildFuerKi: kiBild });
      geaendert();
      if (r.hinweis) toast(r.hinweis);
      router.push({ pathname: '/lieferscheine/[id]', params: { id: r.schein.id } });
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Lieferschein konnte nicht angelegt werden', { fehler: true });
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <Seite>
      {laeuft ? (
        <ActivityIndicator size="large" color={farbe.navy} />
      ) : (
        <Reihe>
          {kameraVerfuegbar ? <Knopf titel="Fotografieren" icon="camera" onPress={() => neu('kamera')} testID="ls-kamera" /> : null}
          <Knopf titel={kameraVerfuegbar ? 'Aus Galerie' : 'Lieferschein-Bild wählen'} icon="image" art={kameraVerfuegbar ? 'navy' : 'haupt'} onPress={() => neu('datei')} testID="ls-datei" />
        </Reihe>
      )}
      <Text2 leise>
        {projekt.kiErlaubt
          ? 'KI an: Lieferant, Datum, Nummer, Material und Menge werden aus dem Foto gelesen – bitte danach prüfen.'
          : 'KI aus: Die Angaben trägst du von Hand ein. Das Foto bleibt auf dem Gerät und in deinem OneDrive.'}
      </Text2>
      {sortiert.length === 0 ? <Leer icon="truck-outline" text="Noch keine Lieferscheine." /> : null}
      {sortiert.map((l) => (
        <Zeile
          key={l.id}
          testID={`ls-${l.nummer || l.id}`}
          icon="truck-delivery"
          ton={l.mengeOk === false || l.schaeden ? 'rot' : l.mengeOk ? 'ok' : 'navy'}
          titel={l.lieferant || 'Lieferschein (noch ohne Lieferant)'}
          untertitel={[l.datum ? datumDe(l.datum) : null, l.nummer ? `Nr. ${l.nummer}` : null, l.material, l.menge].filter(Boolean).join(' · ')}
          rechts={
            l.ki === 'ausstehend' ? <Badge text="KI folgt" ton="gelb" /> : l.mengeOk === null ? <Badge text="ungeprüft" ton="gelb" /> : l.mengeOk && !l.schaeden ? <Badge text="geprüft" ton="ok" /> : <Badge text="Abweichung" ton="rot" />
          }
          onPress={() => router.push({ pathname: '/lieferscheine/[id]', params: { id: l.id } })}
        />
      ))}
    </Seite>
  );
}
