import { createTbState, type TbState, type TbWeek } from '../../model/tagesbefehl';
import type { Project } from '../../model/types';
import { changeProject } from '../../store';

/** Edits project.tb through the shared store (undo/redo, local persistence). */
export function changeTb(mutator: (tb: TbState, draft: Project) => void): void {
  changeProject((draft) => {
    draft.tb ??= createTbState();
    mutator(draft.tb, draft);
  });
}

export function changeWeek(
  sheet: string,
  mutator: (week: TbWeek, tb: TbState, draft: Project) => void,
): void {
  changeTb((tb, draft) => {
    const week = tb.wochen[sheet];
    if (!week) throw new Error('Diese Woche ist nicht mehr vorhanden.');
    mutator(week, tb, draft);
  });
}

/** Shared props of the step components. */
export interface TbStepProps {
  project: Project;
  tb: TbState;
  archived: boolean;
  /** Runs an edit and shows a generic local error instead of throwing. */
  run: (action: () => void | Promise<void>) => Promise<boolean>;
}
