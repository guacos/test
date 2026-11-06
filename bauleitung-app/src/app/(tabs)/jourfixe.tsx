import { Leer, Seite, Ueberschrift } from '../../ui/bausteine';
import { MitProjekt } from '../../ui/Rahmen';

export default function JourFixeScreen() {
  return (
    <MitProjekt>
      <Seite>
        <Ueberschrift>Jour-Fixe-Protokolle</Ueberschrift>
        <Leer text="Die Jour-Fixe-Protokolle folgen in Schritt 5." />
      </Seite>
    </MitProjekt>
  );
}
