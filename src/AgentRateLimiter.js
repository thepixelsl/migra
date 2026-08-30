import {
  AGENT_RATE_LIMIT_MAX_REQUESTS,
  AGENT_RATE_LIMIT_WINDOW_MS,
} from "../functions/_agent-rate-limit.js";
import {
  PUBLIC_AVAILABILITY_MAX_UNIQUE_DATES,
  PUBLIC_AVAILABILITY_RATE_LIMIT_WINDOW_MS,
} from "../functions/_public-availability-rate-limit.js";

const ACTIVE_TIMESTAMPS_KEY = "activeTimestamps";
const PUBLIC_AVAILABILITY_DATES_KEY = "publicAvailabilityDates";

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

function activePublicAvailabilityDates(value, now) {
  const cutoff = now - PUBLIC_AVAILABILITY_RATE_LIMIT_WINDOW_MS;
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry) => (
      entry
      && typeof entry.date === "string"
      && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
      && Number.isFinite(entry.requestedAt)
      && entry.requestedAt > cutoff
      && entry.requestedAt <= now
    ))
    .sort((left, right) => left.requestedAt - right.requestedAt)
    .slice(-PUBLIC_AVAILABILITY_MAX_UNIQUE_DATES);
}

function publicAvailabilityState(entries, allowed) {
  return {
    allowed,
    limit: PUBLIC_AVAILABILITY_MAX_UNIQUE_DATES,
    remaining: Math.max(0, PUBLIC_AVAILABILITY_MAX_UNIQUE_DATES - entries.length),
    resetAt: entries.length
      ? new Date(entries[0].requestedAt + PUBLIC_AVAILABILITY_RATE_LIMIT_WINDOW_MS).toISOString()
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

  async reservePublicAvailabilityDate(now, date) {
    return this.ctx.storage.transaction(async (transaction) => {
      const entries = activePublicAvailabilityDates(
        await transaction.get(PUBLIC_AVAILABILITY_DATES_KEY),
        now,
      );
      const alreadyActive = entries.some((entry) => entry.date === date);
      const allowed = alreadyActive || entries.length < PUBLIC_AVAILABILITY_MAX_UNIQUE_DATES;
      if (allowed && !alreadyActive) entries.push({ date, requestedAt: now });

      if (entries.length) {
        await transaction.put(PUBLIC_AVAILABILITY_DATES_KEY, entries);
      } else {
        await transaction.delete(PUBLIC_AVAILABILITY_DATES_KEY);
      }
      return { entries, allowed };
    });
  }

  async scheduleCleanup(timestamps) {
    if (!timestamps.length) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(timestamps[0] + AGENT_RATE_LIMIT_WINDOW_MS);
  }

  async schedulePublicAvailabilityCleanup(entries) {
    if (!entries.length) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(
      entries[0].requestedAt + PUBLIC_AVAILABILITY_RATE_LIMIT_WINDOW_MS,
    );
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "POST") {
      return Response.json(
        { error: "method_not_allowed" },
        { status: 405, headers: { Allow: "POST" } },
      );
    }

    const now = this.currentTime();
    if (url.pathname === "/reserve-public-date") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        return Response.json({ error: "invalid_date" }, { status: 400 });
      }
      if (typeof payload?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) {
        return Response.json({ error: "invalid_date" }, { status: 400 });
      }

      const { entries, allowed } = await this.reservePublicAvailabilityDate(now, payload.date);
      await this.schedulePublicAvailabilityCleanup(entries);
      return Response.json(publicAvailabilityState(entries, allowed));
    }

    if (url.pathname !== "/reserve") {
      return Response.json(
        { error: "method_not_allowed" },
        { status: 405, headers: { Allow: "POST" } },
      );
    }

    const { timestamps, allowed } = await this.updateActiveTimestamps(now, true);
    await this.scheduleCleanup(timestamps);

    return Response.json(publicState(timestamps, allowed));
  }

  async alarm() {
    const now = this.currentTime();
    const state = await this.ctx.storage.transaction(async (transaction) => {
      const timestamps = activeTimestamps(
        await transaction.get(ACTIVE_TIMESTAMPS_KEY),
        now,
      );
      const publicDates = activePublicAvailabilityDates(
        await transaction.get(PUBLIC_AVAILABILITY_DATES_KEY),
        now,
      );

      await this.persistActiveTimestamps(transaction, timestamps);
      if (publicDates.length) {
        await transaction.put(PUBLIC_AVAILABILITY_DATES_KEY, publicDates);
      } else {
        await transaction.delete(PUBLIC_AVAILABILITY_DATES_KEY);
      }
      return { timestamps, publicDates };
    });

    const expirations = [
      state.timestamps[0] == null
        ? null
        : state.timestamps[0] + AGENT_RATE_LIMIT_WINDOW_MS,
      state.publicDates[0] == null
        ? null
        : state.publicDates[0].requestedAt + PUBLIC_AVAILABILITY_RATE_LIMIT_WINDOW_MS,
    ].filter(Number.isFinite);

    if (!expirations.length) {
      await this.ctx.storage.deleteAlarm();
      return;
    }
    await this.ctx.storage.setAlarm(Math.min(...expirations));
  }
}
