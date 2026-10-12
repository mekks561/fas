import { describe, it, expect, beforeEach } from 'vitest';
import {
  HULL_DEFS,
  HULL_ORDER,
  HULL_UNLOCK_IDS,
  SKILL_UNLOCK_IDS,
  UNLOCK_DEFS,
  UNLOCK_ORIGIN,
  getGrantedUnlockIds,
  getUnlockLevel,
  getUnlockName,
  getUnlockRegistryErrors,
  getUnlockSnapshot,
  getUnlocksForLevel,
  hullUnlockId,
  isHullAvailable,
  isSkillUnlocked,
  skillUnlockId,
} from './UnlockRegistry';
import { SkillType } from './skillSlots';
import { markLevelCleared } from './LevelProgress';
import { grantOwnedItem, clearOwnedItems } from './OwnedItems';
import { getAllLevels } from '../levels';

describe('UnlockRegistry', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── 数据一致性（这一组是悬空奖励的直接防线） ──────────────────────
  describe('注册表自检', () => {
    it('getUnlockRegistryErrors() 为空', () => {
      // 若这条挂了，先把 errors 打出来看 —— 它说的是哪条数据漂移了
      expect(getUnlockRegistryErrors()).toEqual([]);
    });

    it('关卡数据里的每个解锁 id 都登记了，且登记过的都有关卡授予', () => {
      const declared = new Set([...Object.keys(HULL_UNLOCK_IDS), ...Object.keys(SKILL_UNLOCK_IDS)]);
      const inLevels = new Set(getAllLevels().flatMap((lv) => lv.rewards.unlocks));
      expect([...inLevels].sort()).toEqual([...declared].sort());
    });

    it('十关的奖励序列 = 6 舰体 + 4 技能，交替出现', () => {
      const all = getAllLevels();
      expect(all).toHaveLength(10);
      const sequence = all.flatMap((lv) => lv.rewards.unlocks);
      expect(sequence).toHaveLength(10);
      expect(sequence.map((id) => UNLOCK_DEFS[id]?.kind)).toEqual([
        'hull', // 1
        'skill', // 2
        'hull', // 3
        'skill', // 4
        'hull', // 5
        'skill', // 6
        'hull', // 7
        'skill', // 8
        'hull', // 9
        'hull', // 10
      ]);
      // 第 10 关是旗舰奖励（原为悬空的 achievement-master）
      expect(getUnlocksForLevel(10)).toEqual(['ship-dreadnought']);
    });

    it('每个舰体 / 技能恰好一个解锁 id，且 id 前缀与类别一致', () => {
      expect(HULL_ORDER.every((h) => hullUnlockId(h) !== '')).toBe(true);
      expect(Object.keys(HULL_UNLOCK_IDS).every((id) => id.startsWith('ship-'))).toBe(true);
      expect(Object.keys(SKILL_UNLOCK_IDS).every((id) => id.startsWith('skill-'))).toBe(true);
    });

    it('恰好一艘初始舰体（fighter）', () => {
      expect(HULL_ORDER.filter((h) => HULL_DEFS[h].starter)).toEqual(['fighter']);
    });

    it('已实现的 4 个技能都有解锁 id', () => {
      for (const type of [
        SkillType.MISSILE_STRIKE,
        SkillType.SHIELD_BURST,
        SkillType.TIME_SLOW,
        SkillType.OVERDRIVE,
      ]) {
        expect(skillUnlockId(type)).not.toBe('');
      }
    });
  });

  // ── 派生「已授予」集合 ────────────────────────────────────────────
  describe('已授予解锁（由通关记录派生）', () => {
    it('全新存档：只有初始舰体，技能全锁', () => {
      const snap = getUnlockSnapshot();
      expect(snap.hulls).toEqual(['fighter']);
      expect(snap.skills).toEqual([]);
      expect(snap.granted.has('ship-bomber')).toBe(false);
    });

    it('通关第 2 关解锁导弹打击，但不会连带解锁第 3 关的轰炸机', () => {
      markLevelCleared(2, 3);
      const snap = getUnlockSnapshot();
      expect(snap.skills).toEqual([SkillType.MISSILE_STRIKE]);
      expect(isSkillUnlocked(SkillType.MISSILE_STRIKE)).toBe(true);
      expect(isSkillUnlocked(SkillType.SHIELD_BURST)).toBe(false);
      expect(isHullAvailable('bomber')).toBe(false);
    });

    it('通关第 10 关解锁无畏舰', () => {
      markLevelCleared(10, 3);
      expect(isHullAvailable('dreadnought')).toBe(true);
      expect(getUnlockSnapshot().hulls).toContain('dreadnought');
    });

    it('幂等且可补发：清完后在任何时刻读结果一致（不依赖「通关那一刻发一次」）', () => {
      markLevelCleared(5, 2);
      const first = [...getGrantedUnlockIds()].sort();
      const second = [...getGrantedUnlockIds()].sort();
      expect(second).toEqual(first);
      expect(first).toContain('ship-cruiser');
      // 再读一次快照也不变
      expect(getUnlockSnapshot().hulls).toEqual(['fighter', 'cruiser']);
    });

    it('未通关的关卡不授予任何东西', () => {
      const snap = getUnlockSnapshot();
      expect(snap.pending.map((p) => p.level)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(snap.pending.every((p) => p.level > 0)).toBe(true);
    });

    it('pending 里带着「通关第 N 关解锁」需要的信息', () => {
      const pending = getUnlockSnapshot().pending;
      const missile = pending.find((p) => p.id === 'skill-missile-strike');
      expect(missile).toMatchObject({ level: 2, kind: 'skill' });
      // 名字与真源一致，不是在注册表里另抄一份
      expect(missile?.name).toBe('导弹打击');
    });
  });

  // ── 商店买的船顺带解锁外观 ────────────────────────────────────────
  describe('商店购买的舰体', () => {
    it('买下商店的船也解锁对应外观（避免买完还开初始机）', () => {
      grantOwnedItem({
        id: 'shop-item-02',
        name: '隐形战机',
        type: 'ship',
        subtype: 'stealth',
        price: 25000,
        attributes: { health: 80 },
      });
      expect(isHullAvailable('stealth')).toBe(true);
      expect(getUnlockSnapshot().hulls).toEqual(['fighter', 'stealth']);
    });

    it('非 ship 类物品不会解锁外观', () => {
      grantOwnedItem({
        id: 'shop-item-13',
        name: '红色涂装',
        type: 'cosmetic',
        subtype: 'hull-skin',
        price: 2000,
        attributes: { texture: 'tex-hull-red' },
      });
      expect(getUnlockSnapshot().hulls).toEqual(['fighter']);
      clearOwnedItems();
    });

    it('未登记子类型的 ship 不影响外观，也不报错', () => {
      grantOwnedItem({ id: 'x', name: 'x', type: 'ship', subtype: 'unknown-hull', price: 1 });
      expect(getUnlockSnapshot().hulls).toEqual(['fighter']);
      expect(getUnlockRegistryErrors()).toEqual([]);
    });
  });

  // ── 查询辅助 ──────────────────────────────────────────────────────
  describe('查询辅助', () => {
    it('getUnlockLevel / getUnlockName 来自真源', () => {
      expect(getUnlockLevel('ship-cruiser')).toBe(5);
      expect(getUnlockLevel('skill-overdrive')).toBe(8);
      expect(getUnlockLevel('nope')).toBe(0);
      expect(getUnlockName('ship-stealth')).toBe('隐形战机');
      expect(getUnlockName('nope')).toBe('nope'); // 不猜
    });

    it('未登记解锁 id 的技能不参与门控（将来新增技能不会被永久锁死）', () => {
      expect(skillUnlockId(SkillType.EMP_BURST)).toBe('');
      expect(isSkillUnlocked(SkillType.EMP_BURST)).toBe(true);
    });

    it('UNLOCK_ORIGIN 与关卡数据同源', () => {
      getAllLevels().forEach((lv, index) => {
        for (const id of lv.rewards.unlocks) {
          expect(UNLOCK_ORIGIN[id]).toBe(index + 1);
        }
      });
    });
  });
});
