/**
 * 通关进度预置（验证脚本共用）。
 *
 * 为什么需要它：`rewards.unlocks` 接成真链之后，**技能与舰体都按通关进度解锁**。
 * 于是所有「验证技能能开」「验证商店能买」的脚本都有了前置条件 ——
 * 全新存档里 4 个技能全锁、3 艘商店舰船全锁，脚本会整体失效。
 *
 * 这里提供两个口径，各脚本按目的选：
 *   · `seedAllCleared`  —— 十关全通关。用于「只关心某个系统本身」的脚本
 *     （技能激活、成就统计、元进度折算…），把解锁这个前置条件一次性铺平。
 *   · `seedClearedThrough(n)` —— 只通关到第 n 关。用于 `verify-unlocks`
 *     这种**专门验证解锁门控**的脚本，需要造出中间态。
 *
 * 注意：不要去改 `LevelProgress` 的 key 名或结构 —— 那是被 `getGrantedUnlockIds()`
 * 直接读取的真源，脚本跟着改一次就等于多一个会漂移的地方。
 */

const STORAGE_KEY = 'levelProgress';

/** 生成 `n` 关已通关的进度表（`markLevelCleared` 写入的形状）。 */
export function seedClearedThrough(n = 10, totalLevels = 10) {
  const map = {};
  const upto = Math.min(n, totalLevels);
  for (let i = 1; i <= upto; i++) {
    map[String(i)] = { cleared: true, stars: 3, highScore: 0, clearedAt: new Date().toISOString() };
  }
  return map;
}

/** 十关全通关（字符串形式，可直接喂给 `page.evaluate`）。 */
export const seedAllCleared = JSON.stringify(seedClearedThrough(10));

/**
 * 在浏览器里写入预置进度。
 *
 * 只覆盖 `levelProgress` 这一个 key，不碰 credits / ownedItems / selectedHull ——
 * 那些由各脚本自己安排，免得「预置」顺手把被测对象也改掉。
 *
 * @param {import('playwright').Page} page
 * @param {number} through 通关到第几关（1 基，含）
 */
export async function applyProgressSeed(page, through = 10) {
  const payload = JSON.stringify(seedClearedThrough(through));
  await page.evaluate(
    ({ key, json }) => localStorage.setItem(key, json),
    { key: STORAGE_KEY, json: payload },
  );
}
