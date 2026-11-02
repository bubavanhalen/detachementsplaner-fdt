export const NAME: RegExp;
export const ANFORDERUNG: RegExp;
export interface Budget { anforderung: string; budgetMs: number; endung?: string }
export function pruefeBudgets(roh: unknown): Budget[];
export function pruefeBudget(budgets: Budget[], name: string, anforderung: string, budgetMs: number): void;
