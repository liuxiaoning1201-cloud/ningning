/**
 * 遠程對戰相關常數與 helpers。
 * 學生電郵格式：xxxxxxx@student.isf.edu.hk
 */

/** 學生電郵網域（本校學生帳號格式） */
export const STUDENT_EMAIL_SUFFIX = "@student.isf.edu.hk";

/**
 * 判斷是否為學生電郵（符合 xxxxxxx@student.isf.edu.hk 格式）。
 * 教師端分組貼上名單、後端驗證學生身分時可共用此規則。
 */
export function isStudentEmail(email: string | undefined): boolean {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  return trimmed.endsWith(STUDENT_EMAIL_SUFFIX.toLowerCase());
}
