// Mitgelieferte Vorlagen und Auswahl (Vertrag E1-02a Abschnitt 2; AR0-18: keine globale Registry).

import { modelError } from '../errors';
import { kpTemplate } from './kp';
import type { LevelTemplate, TemplateSet } from './types';

export { kpTemplate } from './kp';
export { applyNewPlanDays } from './newPlanDays';
export type {
  FontSizes,
  LevelTemplate,
  TemplateColumnSet,
  TemplateDayPreset,
  TemplateFunctionEntry,
  TemplateRapportCode,
  TemplateSet,
  TemplateWeekPreset,
} from './types';

/** Rein; enthält die Kp-Vorlage unter ihrer id (Bat ab Etappe 3). */
export function builtInTemplates(): TemplateSet {
  const kp = kpTemplate();
  return new Map([[kp.id, kp]]);
}

/** Unbekannte id → ModelError 'unknownTemplate'. */
export function templateById(id: string, templates: TemplateSet): LevelTemplate {
  const template = templates.get(id);
  if (template === undefined) throw modelError('unknownTemplate');
  return template;
}
