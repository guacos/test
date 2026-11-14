import { useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { Foto, Plan } from '../../domain/types';
import { fotoAnlegen } from '../../dienste/fotos';
import { bildWaehlen } from '../../foto/aufnahme';
import { holeRepo, useAktivesProjekt, useApp } from '../../state/useApp';
import { useDaten } from '../../state/useDaten';
import { Auswahl, Feld, IconKnopf, Karte, Knopf, Leer, Seite, Text2 } from '../../ui/bausteine';
import { bestaetigen } from '../../ui/bestaetigen';
import { Bild } from '../../ui/Bild';
import { MitProjekt, Titel } from '../../ui/Rahmen';
import { farbe, groesse } from '../../ui/theme';
import { toast } from '../../ui/toast';

export default function PlaeneScreen() {
  return (
    <>
      <Titel text="Grundrisse" zurueckZu="/maengel" />
      <MitProjekt>
        <Liste />
      </MitProjekt>
    </>
  );
}

function Liste() {
  const projekt = useAktivesProjekt()!;
  const geaendert = useApp((s) => s.geaendert);
  const geschosse = useApp((s) => s.geschosse);
  const plaene = useDaten<Plan>('plan', projekt.id);
  const fotos = useDaten<Foto>('foto', projekt.id) ?? [];
  const [name, setName] = useState('');
  const [geschoss, setGeschoss] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  if (!plaene) return null;

  async function hinzu() {
    if (!name.trim()) return toast('Bitte zuerst einen Namen eingeben', { fehler: true });
    try {
      setLaedt(true);
      const bild = await bildWaehlen();
      if (!bild) return;
      const foto = await fotoAnlegen(holeRepo(), projekt, bild, { ablage: 'plan', geschoss });
      await holeRepo().neu<Plan>('plan', projekt.id, { name: name.trim(), geschoss: geschoss ?? '', fotoId: foto.id });
      setName('');
      setGeschoss(null);
      geaendert();
      toast('Grundriss hinzugefügt');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Grundriss konnte nicht hinzugefügt werden', { fehler: true });
    } finally {
      setLaedt(false);
    }
  }

  return (
    <Seite>
      <Text2 leise>
        Grundrisse werden als Bild hinterlegt (z. B. Foto oder Bildexport des Plans). In einem Mangel tippst du dann auf die Stelle im Grundriss.
      </Text2>
      <Karte>
        <Feld label="Name des Grundrisses" value={name} onChangeText={setName} placeholder="z. B. Grundriss 1. OG" testID="feld-plan-name" />
        <Auswahl label="Geschoss" werte={geschosse} wert={geschoss} onChange={setGeschoss} leerText="ohne" testID="plan-geschoss" />
        {laedt ? <ActivityIndicator color={farbe.navy} /> : <Knopf titel="Bild auswählen und hinzufügen" icon="image-plus" onPress={hinzu} testID="plan-hinzu" />}
      </Karte>
      {plaene.length === 0 ? <Leer icon="floor-plan" text="Noch keine Grundrisse." /> : null}
      {plaene.map((p) => {
        const foto = fotos.find((f) => f.id === p.fotoId);
        return (
          <Karte key={p.id} testID={`plan-${p.name}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ flex: 1, fontSize: groesse.schrift + 1, fontWeight: '800', color: farbe.text }}>
                {p.name}
                {p.geschoss ? ` · ${p.geschoss}` : ''}
              </Text>
              <IconKnopf
                icon="trash-can-outline"
                label="Grundriss löschen"
                ton="neutral"
                onPress={async () => {
                  if (!(await bestaetigen('Grundriss löschen?', p.name))) return;
                  await holeRepo().loesche(p);
                  if (foto) await holeRepo().loesche(foto);
                  geaendert();
                }}
              />
            </View>
            {foto ? <Bild foto={foto} einpassen style={{ width: '100%', aspectRatio: foto.breite / foto.hoehe || 4 / 3, maxHeight: 320, borderRadius: 10 }} /> : null}
          </Karte>
        );
      })}
    </Seite>
  );
}
