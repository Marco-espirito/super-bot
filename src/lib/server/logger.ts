import "server-only";

type LogLevel = "info" | "warn" | "error";

export function log(level: LogLevel, event: string, context: Record<string, unknown> = {}) {
  const entry = JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...context });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
