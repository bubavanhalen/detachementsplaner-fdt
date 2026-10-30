// H-UI2, Befunde SA-H-06 und SA-H-19: Sperrdialoge des WAP-Planers einzeln, ohne Datenbank. «#sicherung» öffnet beim
// Laden den Dialog «Sicherung vor dem Update» (I2Dialog, nicht schliessbar), «#schreiben» den Fortschritt im Schritt
// «Schreiben», «#lesen» den Fortschritt vor dem Schreiben (Esc = Abbrechen), «#normal» einen gewöhnlichen Dialog –
// alles ohne Nutzeraktivierung. Zähler im Dokument (`data-*`) zeigen Abbrechen und Schliessen. Nur fiktive Texte.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BlockingProgress } from '../../../src/components/wap/flows/StandAndPdf';
import { I2Dialog } from '../../../src/components/wap/i2/I2Dialog';
import '../../../src/components/wap/i2/app.css';

function Sperre({ art }: { readonly art: string }) {
  const [offen, setOffen] = useState(true);
  const [abgebrochen, setAbgebrochen] = useState(0);
  const [geschlossen, setGeschlossen] = useState(0);
  return (
    <main data-abgebrochen={abgebrochen} data-geschlossen={geschlossen} data-offen={String(offen)}>
      <h1>Sperrdialoge</h1>
      <p>Abgebrochen: {abgebrochen}</p>
      <p>Geschlossen: {geschlossen}</p>
      {offen && art === 'sicherung' && (
        <I2Dialog
          title="Sicherung vor dem Update"
          dismissible={false}
          onClose={() => setGeschlossen((n) => n + 1)}
          description="Fiktive Umstellung: zuerst die Plan-Dateien sichern."
        >
          <button type="button" className="btn btn-primary" onClick={() => setOffen(false)}>
            Plan-Dateien sichern und fortfahren
          </button>
        </I2Dialog>
      )}
      {offen && (art === 'schreiben' || art === 'lesen') && (
        <BlockingProgress
          title="Stand wird gesetzt …"
          step={
            art === 'schreiben'
              ? 'Stand wird gespeichert (Schritt 3 von 3)'
              : 'PDF Woche 1 (Schritt 2 von 3)'
          }
          writing={art === 'schreiben'}
          writingNote="Das Speichern hat begonnen: «Abbrechen» ist nicht mehr möglich, der Stand wird vollständig gesetzt."
          onAbort={() => {
            setAbgebrochen((n) => n + 1);
            setOffen(false);
          }}
        />
      )}
      {offen && art === 'normal' && (
        <I2Dialog
          title="Gewöhnlicher Dialog"
          onClose={() => {
            setGeschlossen((n) => n + 1);
            setOffen(false);
          }}
        >
          <p>Fiktiver Inhalt.</p>
        </I2Dialog>
      )}
    </main>
  );
}

const root = document.getElementById('root');
if (root !== null) createRoot(root).render(<Sperre art={location.hash.slice(1)} />);
