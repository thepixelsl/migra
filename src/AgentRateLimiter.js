import {
  AGENT_RATE_LIMIT_MAX_REQUESTS,
  AGENT_RATE_LIMIT_WINDOW_MS,
} from "../functions/_agent-rate-limit.js";

const ACTIVE_TIMESTAMPS_KEY = "activeTimestamps";

function activeTimestamps(value, now) {
  const cutoff = now - AGENT_RATE_LIMIT_WINDOW_MS;
  if (!Array.isArray(value)) return [];

  return value
    .filter((timestamp) => Number.isFinite(timestamp) && timestamp > cutoff && timestamp <= now)
    .sort((left, right) => left - right)
    .slice(-AGENT_RATE_LIMIT_MAX_REQUESTS);
}

function publicState(timestamps, allowed) {
  return {
    allowed,
    limit: AGENT_RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, AGENT_RATE_LIMIT_MAX_REQUESTS - timestamps.length),
    resetAt: timestamps.length
      ? new Date(timestamps[0] + AGENT_RATE_LIMIT_WINDOW_MS).toISOString()
      : null,
  };
}

export class AgentRateLimiter {
  constructor(ctx) {
    this.ctx = ctx;
  }

  currentTime() {
    return Date.now();
  }

  async persistActiveTimestamps(storage, timestamps) {
    if (!timestamps.length) {
      await storage.delete(ACTIVE_TIMESTAMPS_KEY);
      return;
    }

    await storage.put(ACTIVE_TIMESTAMPS_KEY, timestamps);
  }

  async updateActiveTimestamps(now, reserveRequest) {
    return this.ctx.storage.transaction(async (transaction) => {
      const timestamps = activeTimestamps(
        await transaction.get(ACTIVE_TIMESTAMPS_KEY),
        now,
      );
      const allowed = !reserveRequest
        || timestamps.length < AGENT_RATE_LIMIT_MAX_REQUESTS;
      if (reserveRequest && allowed) timestamps.push(now);
      await this.persistActiveTimestamps(transaction, timestamps);
      return { timestamps, allowed };
    });
  }

  async scheduleCleanup(timestamps) {
    if (!timestamps.length) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(timestamps[0] + AGENT_RATE_LIMIT_WINDOW_MS);
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/reserve") {
      return Response.json(
        { error: "method_not_allowed" },
        { status: 405, headers: { Allow: "POST" } },
      );
    }

    const now = this.currentTime();
    const { timestamps, allowed } = await this.updateActiveTimestamps(now, true);
    await this.scheduleCleanup(timestamps);

    return Response.json(publicState(timestamps, allowed));
  }

  async alarm() {
    const now = this.currentTime();
    const { timestamps } = await this.updateActiveTimestamps(now, false);
    await this.scheduleCleanup(timestamps);
  }
}
