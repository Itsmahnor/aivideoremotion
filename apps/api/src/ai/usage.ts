/** USD per million tokens. Verify against Anthropic's pricing page and edit when prices change. */
export const PRICES = {input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5};

export type Usage = {input: number; output: number; cacheRead: number; cacheWrite: number};

export const emptyUsage = (): Usage => ({input: 0, output: 0, cacheRead: 0, cacheWrite: 0});

export const addUsage = (total: Usage, add: Usage): Usage => ({
  input: total.input + add.input,
  output: total.output + add.output,
  cacheRead: total.cacheRead + add.cacheRead,
  cacheWrite: total.cacheWrite + add.cacheWrite,
});

export const costUsd = (usage: Usage): number =>
  (usage.input * PRICES.input + usage.output * PRICES.output + usage.cacheRead * PRICES.cacheRead + usage.cacheWrite * PRICES.cacheWrite) / 1_000_000;

export const usageFromResponse = (response: {usage: {input_tokens: number; output_tokens: number; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null}}): Usage => ({
  input: response.usage.input_tokens,
  output: response.usage.output_tokens,
  cacheRead: response.usage.cache_read_input_tokens ?? 0,
  cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
});
