// AI Usage Tracker — tracks Claude API token usage per service
// Stores in-memory (resets on restart). For persistent tracking, replace with Redis/DB.
//
// Pricing (Claude Sonnet 4, as of 2025):
// Input:  $3.00 per 1M tokens
// Output: $15.00 per 1M tokens

export const INPUT_COST_PER_M  = 3.00;
export const OUTPUT_COST_PER_M = 15.00;

export interface ServiceUsage {
  service: string;
  inputTokens: number;
  outputTokens: number;
  calls: number;
  lastUsed: string;
  costUsd: number;
}

// In-memory store: serviceName → usage
const usageStore = new Map<string, ServiceUsage>();

export function recordUsage(service: string, inputTokens: number, outputTokens: number) {
  const existing = usageStore.get(service) ?? {
    service,
    inputTokens: 0,
    outputTokens: 0,
    calls: 0,
    lastUsed: '',
    costUsd: 0,
  };

  const newInput  = existing.inputTokens  + inputTokens;
  const newOutput = existing.outputTokens + outputTokens;
  const costUsd   = (newInput / 1_000_000) * INPUT_COST_PER_M +
                    (newOutput / 1_000_000) * OUTPUT_COST_PER_M;

  usageStore.set(service, {
    service,
    inputTokens:  newInput,
    outputTokens: newOutput,
    calls:        existing.calls + 1,
    lastUsed:     new Date().toISOString(),
    costUsd:      Math.round(costUsd * 10000) / 10000,
  });
}

export function getUsage(service: string): ServiceUsage | null {
  return usageStore.get(service) ?? null;
}

export function getAllUsage(): ServiceUsage[] {
  return Array.from(usageStore.values())
    .sort((a, b) => b.costUsd - a.costUsd);
}

export function getTotalUsage() {
  const all = getAllUsage();
  const totalInput  = all.reduce((s, u) => s + u.inputTokens, 0);
  const totalOutput = all.reduce((s, u) => s + u.outputTokens, 0);
  const totalCost   = all.reduce((s, u) => s + u.costUsd, 0);
  const totalCalls  = all.reduce((s, u) => s + u.calls, 0);
  return {
    totalInput,
    totalOutput,
    totalCost:   Math.round(totalCost * 10000) / 10000,
    totalCalls,
    services:    all.length,
  };
}