// Gemeinsame Typen des Seitenfelds (I3 C1; UI-Richtlinie 6).
import type { CommandContext, CommandResult } from '../../../model/wap/commands/command';
import type { Id, IsoDate, Plan } from '../../../model/wap/types';

export type RunCommand = (plan: Plan, ctx: CommandContext) => CommandResult;

/** Was das Seitenfeld zeigt: nichts gewählt → Woche; Tag(e) → Tag; Einträge → Eintrag bzw. gemeinsame Felder. */
export type PanelTarget =
  | { readonly kind: 'entries'; readonly ids: readonly Id[]; readonly windowId: Id | null }
  | { readonly kind: 'days'; readonly dates: readonly IsoDate[] }
  | { readonly kind: 'week' };

export interface PanelActions {
  /** Führt einen Befehl aus (ein Undo-Schritt, sofort gespeichert); Fehler zeigt das Seitenfeld. */
  readonly run: (cmd: RunCommand) => void;
  /** Fokus zurück ans Raster (Esc im Feld, UI-Richtlinie 6). */
  readonly toGrid: () => void;
  readonly remove: (ids: readonly Id[]) => void;
  readonly renumber: (date: IsoDate) => void;
  /** Sichtbare Meldung im Seitenfeld (z.B. nicht übernommene ungültige Eingabe beim Auswahlwechsel, UX-H-01). */
  readonly notice?: (message: string) => void;
  readonly disabled: boolean;
}
