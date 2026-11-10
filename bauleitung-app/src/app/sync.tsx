import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { datumDe } from '../domain/datum';
import { bezeichnung, TYP_NAME, unterschiede } from '../domain/suche';
import { redirectUri } from '../ms/auth';
import { TEST_TOKEN } from '../ms/config';
import { useApp } from '../state/useApp';
import {
  abmeldenMs,
  anmeldenMs,
  beitreten,
  jetztAbgleichen,
  konflikteLaden,
  konfliktLoesen,
  setzeClientId,
  setzeOutlook,
  useSync,
  type KonfliktAnzeige,
} from '../sync/dienst';
import { Abschnitt, Badge, Feld, Karte, Knopf, Leer, SchalterZeile, Seite, Text2, Trenner } from '../ui/bausteine';
import { bestaetigen } from '../ui/bestaetigen';
import { Titel } from '../ui/Rahmen';
import { farbe, groesse } from '../ui/theme';
import { toast } from '../ui/toast';

const STATUS: Record<string, string> = {
  aus: 'Nicht verbunden',
  bereit: 'Abgeglichen',
  laeuft: 'Abgleich läuft …',
  offline: 'Kein Netz – der Abgleich folgt automatisch',
  fehler: 'Abgleich mit Hinweisen',
};

function zeit(iso: string | null): string {
  if (!iso) return 'noch nie';
  const d = new Date(iso);
  return `${datumDe(iso.slice(0, 10))}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} Uhr`;
}

export default function SyncScreen() {
  const sync = useSync();
  const stand = useApp((s) => s.datenStand);
  const [clientId, setClientId] = useState(sync.clientId);
  const [link, setLink] = useState('');
  const [arbeitet, setArbeitet] = useState(false);
  const [konflikte, setKonflikte] = useState<KonfliktAnzeige[]>([]);

  useEffect(() => {
    konflikteLaden().then(setKonflikte).catch(() => {});
  }, [sync.konflikte, sync.letzter, stand]);

  async function anmelden() {
    setArbeitet(true);
    try {
      await setzeClientId(clientId);
      const konto = await anmeldenMs();
      toast(`Angemeldet als ${konto.name || konto.email}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Anmeldung fehlgeschlagen', { fehler: true, dauerMs: 7000 });
    } finally {
      setArbeitet(false);
    }
  }

  async function abgleich() {
    const erg = await jetztAbgleichen();
    if (erg) {
      const teile = [`${erg.hoch} hoch`, `${erg.runter} herunter`];
      if (erg.fotos) teile.push(`${erg.fotos} Foto(s)`);
      if (erg.ablage) teile.push(`${erg.ablage} PDF`);
      toast(`Abgleich fertig: ${teile.join(', ')}${erg.konflikte ? ` · ${erg.konflikte} Konflikt(e)` : ''}`, { fehler: erg.fehler.length > 0 });
    }
  }

  async function projektHinzu() {
    if (!link.trim()) return;
    setArbeitet(true);
    try {
      const p = await beitreten(link);
      setLink('');
      toast(`Projekt „${p.name}“ hinzugefügt`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Projekt konnte nicht hinzugefügt werden', { fehler: true, dauerMs: 7000 });
    } finally {
      setArbeitet(false);
    }
  }

  async function loese(k: KonfliktAnzeige, wahl: 'meine' | 'andere' | 'beide') {
    await konfliktLoesen(k.id, wahl);
    toast(wahl === 'meine' ? 'Deine Version gilt' : wahl === 'andere' ? 'Die andere Version gilt' : 'Beide Versionen behalten');
  }

  return (
    <Seite>
      <Titel text="Microsoft-Konto und Abgleich" />

      <Abschnitt titel="Microsoft-Konto">
        {sync.konto ? (
          <Karte balken={farbe.ok} testID="konto-karte">
            <Text style={{ fontSize: groesse.schriftGross, fontWeight: '800', color: farbe.text }}>{sync.konto.name || 'Angemeldet'}</Text>
            <Text2 leise>{sync.konto.email}</Text2>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              <Badge text="OneDrive" ton="ok" icon="check" />
              <Badge text={sync.konto.outlook ? 'Outlook' : 'Outlook aus'} ton={sync.konto.outlook ? 'ok' : 'neutral'} icon={sync.konto.outlook ? 'check' : 'minus'} />
            </View>
            {!TEST_TOKEN ? (
              <Knopf
                titel="Abmelden"
                art="neben"
                klein
                onPress={async () => {
                  if (await bestaetigen('Abmelden?', 'Deine Daten bleiben auf dem Gerät. Der Abgleich pausiert, bis du dich wieder anmeldest.', 'Abmelden')) await abmeldenMs();
                }}
                testID="abmelden"
              />
            ) : null}
          </Karte>
        ) : (
          <>
            <Text2 leise>
              Melde dich mit deinem Microsoft-Konto an, damit deine Daten in deinem OneDrive unter „Bauleitung-App“ liegen und auf Handy und Mac gleich sind.
              Ohne Anmeldung bleibt alles nur auf diesem Gerät.
            </Text2>
            <Feld
              label="Anwendungs-ID (Client-ID) aus der Microsoft-App-Registrierung"
              value={clientId}
              onChangeText={setClientId}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              testID="feld-client-id"
              hinweis={`Einmalig einrichten, siehe README Teil E. Rücksprung-Adresse für die Registrierung: ${redirectUri()}`}
            />
            <SchalterZeile
              label="Outlook-Funktionen"
              wert={sync.outlookGewuenscht}
              onChange={setzeOutlook}
              testID="schalter-outlook"
              hinweis="AN: Die App darf in deinem Namen E-Mails senden (Protokoll-Versand) und Termine in deinen Kalender eintragen. Du wirst bei der Anmeldung danach gefragt."
            />
            {arbeitet ? <ActivityIndicator size="large" color={farbe.navy} /> : <Knopf titel="Mit Microsoft anmelden" icon="microsoft" onPress={anmelden} testID="anmelden" />}
          </>
        )}
      </Abschnitt>

      <Abschnitt titel="Abgleich mit OneDrive">
        <Karte testID="sync-karte">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {sync.status === 'laeuft' ? <ActivityIndicator color={farbe.navy} /> : null}
            <Text style={{ flex: 1, fontSize: groesse.schrift + 1, fontWeight: '800', color: farbe.text }} testID="sync-status">
              {STATUS[sync.status]}
            </Text>
          </View>
          <Text2 leise>Letzter Abgleich: {zeit(sync.letzter)}</Text2>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Badge text={`${sync.offen} warten auf Upload`} ton={sync.offen ? 'gelb' : 'ok'} icon="cloud-upload-outline" />
            <Badge text={`${sync.konflikte} Konflikt(e)`} ton={sync.konflikte ? 'rot' : 'ok'} icon="alert-outline" />
          </View>
          {sync.meldungen.map((m, i) => (
            <Text2 key={i} farbeText={farbe.rot}>
              {m}
            </Text2>
          ))}
          <Knopf titel="Jetzt abgleichen" icon="cloud-sync" art="navy" deaktiviert={!sync.konto || sync.status === 'laeuft'} onPress={abgleich} testID="jetzt-abgleichen" />
        </Karte>
      </Abschnitt>

      <Abschnitt titel={`Konflikte (${konflikte.length})`}>
        {konflikte.length === 0 ? (
          <Leer icon="check-circle-outline" text="Keine Konflikte. Ändern zwei Geräte denselben Eintrag gleichzeitig, erscheint er hier – nichts wird still überschrieben." />
        ) : null}
        {konflikte.map((k) => {
          const diff = k.lokal ? unterschiede(k.lokal, k.remote) : [];
          return (
            <Karte key={k.id} balken={farbe.rot} testID="konflikt">
              <Text style={{ fontSize: groesse.schrift + 1, fontWeight: '800', color: farbe.text }}>
                {TYP_NAME[k.remote.typ]}: {bezeichnung(k.lokal ?? k.remote)}
              </Text>
              <Text2 leise>
                Andere Version von {k.remote.geaendertVon}, {zeit(k.remote.geaendertAm)}
              </Text2>
              {diff.map((d) => (
                <View key={d.feld} style={{ gap: 2 }}>
                  <Trenner />
                  <Text style={{ fontSize: groesse.schriftKlein, fontWeight: '800', color: farbe.textLeise, marginTop: 6 }}>{d.feld}</Text>
                  <Text2>
                    <Text style={{ fontWeight: '800' }}>Meine: </Text>
                    {d.meine}
                  </Text2>
                  <Text2>
                    <Text style={{ fontWeight: '800' }}>Andere: </Text>
                    {d.andere}
                  </Text2>
                </View>
              ))}
              <Knopf titel="Meine Version behalten" klein art="navy" onPress={() => loese(k, 'meine')} testID="konflikt-meine" />
              <Knopf titel="Andere Version übernehmen" klein art="neben" onPress={() => loese(k, 'andere')} testID="konflikt-andere" />
              {k.remote.typ !== 'projekt' && k.remote.typ !== 'einstellungen' ? (
                <Knopf titel="Beide behalten (meine als Kopie)" klein art="neben" onPress={() => loese(k, 'beide')} testID="konflikt-beide" />
              ) : null}
            </Karte>
          );
        })}
      </Abschnitt>

      <Abschnitt titel="Team: geteiltes Projekt hinzufügen">
        <Text2 leise>
          Hat dir jemand einen Projektordner in OneDrive freigegeben? Füge hier den Freigabe-Link ein. Deine Rechte entsprechen der Freigabe in OneDrive
          (nur lesen oder bearbeiten). Verknüpfungen in „Meine Dateien“ erkennt die App von selbst.
        </Text2>
        <Feld label="Freigabe-Link" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} placeholder="https://1drv.ms/…" testID="feld-link" />
        <Knopf titel="Projekt hinzufügen" icon="account-multiple-plus" art="neben" deaktiviert={!sync.konto || !link.trim() || arbeitet} onPress={projektHinzu} testID="beitreten" />
      </Abschnitt>
    </Seite>
  );
}
