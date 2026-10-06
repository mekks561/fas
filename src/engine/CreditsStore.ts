/**
 * 信用点（金币）的唯一存储入口。
 *
 * 此前读写散落在 ShopPanel 里直接操作 localStorage（key: 'credits'），
 * 关卡完成奖励无处可发。这里收敛成一个模块：商店消费、关卡结算、
 * 后续的日常挑战奖励都走它，避免 key 字符串在多处重复。
 *
 * 存储选型说明：仍沿用 localStorage（与 levelProgress / purchasedItems 一致）。
 * 它只存在本机浏览器，清缓存会丢——迁移到云端账号是独立的一轮工作。
 */

const CREDITS_KEY = 'credits';

/** 新账号初始信用点（与商店此前的默认值保持一致）。 */
export const INITIAL_CREDITS = 10000;

/** 读取当前信用点；无记录或损坏时返回初始值。 */
export function getCredits(): number {
  try {
    const raw = localStorage.getItem(CREDITS_KEY);
    if (raw === null) return INITIAL_CREDITS;
    const value = Number.parseInt(raw, 10);
    return Number.isFinite(value) && value >= 0 ? value : INITIAL_CREDITS;
  } catch {
    return INITIAL_CREDITS;
  }
}

/** 写入信用点（负数会被夹到 0）。 */
export function setCredits(value: number): number {
  const safe = Math.max(0, Math.floor(value));
  try {
    localStorage.setItem(CREDITS_KEY, String(safe));
  } catch {
    /* 隐私模式下写入会抛，静默忽略：游戏不应因存档失败而中断 */
  }
  return safe;
}

/** 增加信用点（关卡奖励等），返回新余额。 */
export function addCredits(amount: number): number {
  return setCredits(getCredits() + amount);
}

/**
 * 扣除信用点。余额不足时不扣、返回 false，由调用方决定提示。
 * @returns 是否扣款成功
 */
export function spendCredits(amount: number): boolean {
  const current = getCredits();
  if (amount > current) return false;
  setCredits(current - amount);
  return true;
}
