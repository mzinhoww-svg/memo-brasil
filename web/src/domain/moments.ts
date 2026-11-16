/** Momento da programação: "21:00|Primeira dança" (horário opcional). O nome é o que vai na foto; o horário só na programação. */
export interface Moment { time?: string; name: string }
const RE = /^([01]\d|2[0-3]):([0-5]\d)\|(.+)$/;
export function splitMoment(raw: string): Moment {
  const m = RE.exec(raw);
  return m ? { time: `${m[1]}:${m[2]}`, name: m[3].trim() } : { name: raw };
}
export function joinMoment(time: string | undefined, name: string): string {
  const n = name.trim();
  return time && /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? `${time}|${n}` : n;
}
export const momentName = (raw: string): string => splitMoment(raw).name;
