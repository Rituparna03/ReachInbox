import { redis } from '../redis';

const HOUR = 3_600_000;
export const windowOf = (ms: number) => Math.floor(ms / HOUR);

/**
 * Atomically reserve one send slot for `sender` in the earliest hour window
 * (starting at `fromWindow`) that still has capacity. Runs inside Redis (Lua),
 * so it is safe across any number of workers/instances. Because overflow jobs
 * fill later windows in the order they reserve, ordering is preserved as much as possible.
 */
const RESERVE_LUA = `
local prefix, from, limit = ARGV[1], tonumber(ARGV[2]), tonumber(ARGV[3])
local w = from
while true do
  local key = prefix .. w
  local c = tonumber(redis.call('GET', key) or '0')
  if c < limit then
    redis.call('INCR', key)
    redis.call('EXPIRE', key, 172800)
    return w
  end
  w = w + 1
end
`;

export async function reserveSlot(senderId: string, limit: number, now = Date.now()) {
  const nowWindow = windowOf(now);
  const window = Number(await redis.eval(RESERVE_LUA, 0, `rl:${senderId}:`, nowWindow, limit));
  return { window, nowWindow, deferred: window > nowWindow, runAt: window * HOUR };
}

/** True exactly once per (sender, window) -> a single Slack alert per limit hit. */
export async function firstLimitHit(senderId: string, window: number) {
  return (await redis.set(`rl:notified:${senderId}:${window}`, '1', 'EX', 7200, 'NX')) === 'OK';
}
