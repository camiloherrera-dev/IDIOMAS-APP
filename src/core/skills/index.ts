import { db, type LingoDB, type SkillRow } from '@/db';

/** fallos a partir de los cuales un punto se considera débil */
export const WEAK_AFTER = 3;
/** aciertos seguidos con los que deja de serlo */
export const MASTERED_STREAK = 5;

export const skillKey = (langId: string, skill: string) => `${langId}:${skill}`;

/** registra un acierto o fallo en un punto practicado (p. ej. una estructura gramatical) */
export async function recordSkill(langId: string, skill: string, correct: boolean, now = new Date(), database: LingoDB = db) {
  const key = skillKey(langId, skill);
  const row: SkillRow = (await database.skills.get(key)) ?? { key, langId, skill, wrong: 0, streak: 0, total: 0 };
  const streak = correct ? row.streak + 1 : 0;
  await database.skills.put({
    ...row,
    total: row.total + 1,
    streak,
    wrong: correct ? (streak >= MASTERED_STREAK ? 0 : row.wrong) : row.wrong + 1,
    lastWrongAt: correct ? row.lastWrongAt : now.getTime(),
  });
}

export const isWeak = (row: SkillRow) => row.wrong >= WEAK_AFTER;

/** puntos débiles de un idioma, del más fallado al menos */
export async function weakSkills(langId: string, database: LingoDB = db): Promise<SkillRow[]> {
  const rows = await database.skills.where('langId').equals(langId).toArray();
  return rows.filter(isWeak).sort((a, b) => b.wrong - a.wrong || (b.lastWrongAt ?? 0) - (a.lastWrongAt ?? 0));
}

/** marca a mano un punto como débil (p. ej. tras un simulacro) */
export async function flagSkill(langId: string, skill: string, database: LingoDB = db) {
  const key = skillKey(langId, skill);
  const row: SkillRow = (await database.skills.get(key)) ?? { key, langId, skill, wrong: 0, streak: 0, total: 0 };
  await database.skills.put({ ...row, wrong: Math.max(row.wrong, WEAK_AFTER), streak: 0, lastWrongAt: Date.now() });
}
