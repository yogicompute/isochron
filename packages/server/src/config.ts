export type Policy = "drop-slow" | "extend" | "hybrid"

export interface Config {
    policy: Policy;
    percentile: number;
    lagBudgetMs: number;
    minHorizonMs: number;
    maxHorizonMs: number;
}

export const config: Config = {
    policy: "drop-slow",
    percentile: 95,
    lagBudgetMs: 20,
    minHorizonMs: 50,
    maxHorizonMs: 5000
}