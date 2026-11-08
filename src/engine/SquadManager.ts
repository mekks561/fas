// 只引类型：本模块是纯逻辑，运行期不加载 PlayCanvas 引擎（单测因此很轻）
import type * as pc from 'playcanvas';

export type FormationType = 'wedge' | 'circle' | 'column';

/** 创建 / 加入小队时可传的成员描述；只给 id 时 level 默认 1 */
export interface SquadMemberSpec {
  id: string;
  level?: number;
}

/** 每个派系的进化式权重（Phase 1 只记录，不参与逐帧决策） */
export interface SquadWeights {
  aggression: number;
  cohesion: number;
}

interface SquadMember {
  id: string;
  level: number;
}

interface SquadState {
  id: string;
  factionId: string;
  threat: 0 | 1 | 2;
  formation: FormationType;
  members: SquadMember[];
  /** 槽位复用：成员 id → 世界坐标，每帧在原对象上写值，避免持续 new */
  slots: Map<string, pc.Vec3>;
}

const DEFAULT_LEVEL = 1;
/** 队形基础间距 */
const SPACING = 3.0;
/** 楔形首槽前伸距离 */
const WEDGE_FORWARD = 8;
/** 楔形每级后退距离 */
const WEDGE_BACK_STEP = 2.5;
/** 环形半径 */
const CIRCLE_RADIUS = 9;
/** 纵队间距 */
const COLUMN_SPACING = 3.5;
const DEFAULT_WEIGHTS: SquadWeights = { aggression: 0.5, cohesion: 0.5 };
const MIN_WEIGHT = 0.1;
const MAX_WEIGHT = 1.0;

/** 威胁等级 → 队形：0 楔形突击 / 1 环形防御 / 2 纵队追击 */
const FORMATION_BY_THREAT: Record<0 | 1 | 2, FormationType> = {
  0: 'wedge',
  1: 'circle',
  2: 'column',
};

/**
 * 集群战术网的小队管理器（v2.8 Phase 1）。
 *
 * 纯逻辑模块：只依赖 playcanvas 的 pc.Vec3，不 import Enemy / 引擎对象，
 * 因此可以在单测里直接驱动，不需要 WebGL / 场景。
 */
export class SquadManager {
  private squads: Map<string, SquadState> = new Map();
  /** 成员 id → 所属小队 id，反查用，O(1) */
  private memberToSquad: Map<string, string> = new Map();
  private weights: Map<string, SquadWeights> = new Map();
  private squadCounter: number = 0;
  private elapsed: number = 0;

  public createSquad(factionId: string, members: Array<string | SquadMemberSpec>): string {
    this.squadCounter += 1;
    const id = `squad_${this.squadCounter}`;
    this.squads.set(id, {
      id,
      factionId,
      threat: 0,
      formation: FORMATION_BY_THREAT[0],
      members: [],
      slots: new Map(),
    });
    members.forEach((member) => this.addMember(id, member));
    return id;
  }

  public addMember(squadId: string, member: string | SquadMemberSpec): void {
    const squad = this.squads.get(squadId);
    if (!squad) return;

    const spec = typeof member === 'string' ? { id: member } : member;
    if (!spec.id) return;

    const existingSquadId = this.memberToSquad.get(spec.id);
    if (existingSquadId === squadId) return;
    if (existingSquadId) {
      this.removeMember(spec.id);
    }

    const level =
      typeof spec.level === 'number' && Number.isFinite(spec.level) ? spec.level : DEFAULT_LEVEL;
    squad.members.push({ id: spec.id, level });
    this.memberToSquad.set(spec.id, squadId);
  }

  public removeMember(id: string): void {
    const squadId = this.memberToSquad.get(id);
    if (!squadId) return;

    this.memberToSquad.delete(id);

    const squad = this.squads.get(squadId);
    if (!squad) return;

    squad.members = squad.members.filter((member) => member.id !== id);
    squad.slots.delete(id);

    // 空队没有存在意义，直接回收；调用方可用 getMemberCount 判断是否需要重建
    if (squad.members.length === 0) {
      this.squads.delete(squadId);
    }
  }

  /**
   * 每帧重算槽位：剔除失效成员、重新选队长、按威胁等级切队形。
   *
   * `anchor` 通常为玩家位置，`forward` 为突进基准方向（玩家前向）。
   */
  public update(dt: number, anchor: pc.Vec3, forward: pc.Vec3): void {
    this.elapsed += dt;

    // 基准向量每帧只构造一次，槽位在对象上就地写值
    const forwardDir =
      forward && vectorLengthSq(forward) > 1e-6
        ? forward.clone().normalize()
        : anchor.clone().set(0, 0, -1);
    const flatForward = anchor.clone().set(forwardDir.x, 0, forwardDir.z);
    if (vectorLengthSq(flatForward) > 1e-6) {
      flatForward.normalize();
    } else {
      flatForward.set(0, 0, -1);
    }
    const right = anchor.clone().set(-flatForward.z, 0, flatForward.x);

    this.squads.forEach((squad) => {
      // 防御：索引与成员表不一致时以索引为准（removeMember 之外不应出现，但不能拖垮主循环）
      squad.members = squad.members.filter(
        (member) => this.memberToSquad.get(member.id) === squad.id,
      );
      if (squad.members.length === 0) return;

      squad.formation = FORMATION_BY_THREAT[squad.threat];

      // 队长排首槽，其余保持加入顺序 → 同一队槽位分配稳定
      const leader = this.electLeader(squad);
      const orderedMembers = leader
        ? [leader, ...squad.members.filter((member) => member.id !== leader.id)]
        : squad.members;

      for (let i = 0; i < orderedMembers.length; i += 1) {
        const slot = this.getOrCreateSlot(squad, orderedMembers[i].id, anchor);
        this.writeSlot(
          slot,
          i,
          orderedMembers.length,
          anchor,
          forwardDir,
          flatForward,
          right,
          squad.formation,
        );
      }
    });
  }

  public getSlot(id: string): pc.Vec3 | null {
    const squadId = this.memberToSquad.get(id);
    if (!squadId) return null;
    const squad = this.squads.get(squadId);
    return squad?.slots.get(id) ?? null;
  }

  public getFormation(squadId: string): FormationType {
    return this.squads.get(squadId)?.formation ?? FORMATION_BY_THREAT[0];
  }

  public getLeader(squadId: string): string | null {
    const squad = this.squads.get(squadId);
    return squad ? (this.electLeader(squad)?.id ?? null) : null;
  }

  /** 当前存活成员数（空队已被回收，返回 0 也代表该 squadId 已失效） */
  public getMemberCount(squadId: string): number {
    return this.squads.get(squadId)?.members.length ?? 0;
  }

  public setThreat(squadId: string, level: 0 | 1 | 2): void {
    const squad = this.squads.get(squadId);
    if (!squad) return;

    const threat = Math.max(0, Math.min(2, Math.round(level))) as 0 | 1 | 2;
    squad.threat = threat;
    squad.formation = FORMATION_BY_THREAT[threat];
  }

  /** 队内告警：受伤提升威胁；阵亡再提升一级并把该成员移出小队 */
  public broadcastAlert(kind: 'damaged' | 'destroyed', memberId: string): void {
    const squadId = this.memberToSquad.get(memberId);
    if (!squadId) return;

    const squad = this.squads.get(squadId);
    if (!squad) return;

    this.raiseThreat(squad);

    if (kind === 'destroyed') {
      this.removeMember(memberId);
    }
  }

  /**
   * 战斗结算时做一次权重微调（不进主循环）。
   * 击杀提升侵略性 / 凝聚力，损失则压低，权重钳制在 [0.1, 1.0]。
   */
  public recordBattleResult(result: { factionId: string; kills: number; losses: number }): void {
    if (!result || typeof result.factionId !== 'string') return;

    const kills = Number.isFinite(result.kills) && result.kills > 0 ? result.kills : 0;
    const losses = Number.isFinite(result.losses) && result.losses > 0 ? result.losses : 0;

    const weights = this.getWeights(result.factionId);
    weights.aggression = clampWeight(weights.aggression + 0.05 * kills - 0.03 * losses);
    weights.cohesion = clampWeight(weights.cohesion + 0.02 * kills - 0.04 * losses);
    this.weights.set(result.factionId, weights);
  }

  public getWeights(factionId: string): SquadWeights {
    const existing = this.weights.get(factionId);
    return existing ? { ...existing } : { ...DEFAULT_WEIGHTS };
  }

  public serialize(): unknown {
    return {
      version: 1,
      squadCounter: this.squadCounter,
      elapsed: this.elapsed,
      squads: Array.from(this.squads.values(), (squad) => ({
        id: squad.id,
        factionId: squad.factionId,
        threat: squad.threat,
        formation: squad.formation,
        members: squad.members.map((member) => ({ id: member.id, level: member.level })),
      })),
      weights: Array.from(this.weights.entries(), ([factionId, weights]) => ({
        factionId,
        aggression: weights.aggression,
        cohesion: weights.cohesion,
      })),
    };
  }

  public deserialize(data: unknown): void {
    this.destroy();
    if (!data || typeof data !== 'object') return;

    const raw = data as Record<string, unknown>;
    if (typeof raw.squadCounter === 'number' && Number.isFinite(raw.squadCounter)) {
      this.squadCounter = Math.max(0, Math.floor(raw.squadCounter));
    }
    if (typeof raw.elapsed === 'number' && Number.isFinite(raw.elapsed)) {
      this.elapsed = Math.max(0, raw.elapsed);
    }

    if (Array.isArray(raw.squads)) {
      raw.squads.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const saved = item as Record<string, unknown>;
        if (typeof saved.id !== 'string' || !saved.id || this.squads.has(saved.id)) return;

        const factionId = typeof saved.factionId === 'string' ? saved.factionId : 'hostile';
        const threat = normalizeThreat(saved.threat);
        const formation = isFormationType(saved.formation)
          ? saved.formation
          : FORMATION_BY_THREAT[threat];

        const squad: SquadState = {
          id: saved.id,
          factionId,
          threat,
          formation,
          members: [],
          slots: new Map(),
        };

        if (Array.isArray(saved.members)) {
          saved.members.forEach((member) => {
            if (!member || typeof member !== 'object') return;
            const savedMember = member as Record<string, unknown>;
            if (typeof savedMember.id !== 'string' || !savedMember.id) return;
            // 同一成员被写进两支队伍时以先出现者为准
            if (this.memberToSquad.has(savedMember.id)) return;

            const level =
              typeof savedMember.level === 'number' && Number.isFinite(savedMember.level)
                ? savedMember.level
                : DEFAULT_LEVEL;
            squad.members.push({ id: savedMember.id, level });
            this.memberToSquad.set(savedMember.id, squad.id);
          });
        }

        this.squads.set(squad.id, squad);
      });
    }

    if (Array.isArray(raw.weights)) {
      raw.weights.forEach((item) => {
        if (!item || typeof item !== 'object') return;
        const saved = item as Record<string, unknown>;
        if (typeof saved.factionId !== 'string' || !saved.factionId) return;
        this.weights.set(saved.factionId, {
          aggression: clampWeight(saved.aggression),
          cohesion: clampWeight(saved.cohesion),
        });
      });
    }
  }

  public destroy(): void {
    this.squads.clear();
    this.memberToSquad.clear();
    this.weights.clear();
    this.squadCounter = 0;
    this.elapsed = 0;
  }

  private raiseThreat(squad: SquadState): void {
    if (squad.threat >= 2) return;
    squad.threat = (squad.threat + 1) as 0 | 1 | 2;
    squad.formation = FORMATION_BY_THREAT[squad.threat];
  }

  /** 队长选举：level 最高优先，同 level 取 id 字典序最小 */
  private electLeader(squad: SquadState): SquadMember | null {
    let leader: SquadMember | null = null;
    squad.members.forEach((member) => {
      if (
        !leader ||
        member.level > leader.level ||
        (member.level === leader.level && member.id < leader.id)
      ) {
        leader = member;
      }
    });
    return leader;
  }

  private getOrCreateSlot(squad: SquadState, id: string, anchor: pc.Vec3): pc.Vec3 {
    let slot = squad.slots.get(id);
    if (!slot) {
      // 借用 anchor 的构造能力生成同类型 Vec3，避免运行期 import PlayCanvas
      slot = anchor.clone();
      squad.slots.set(id, slot);
    }
    return slot;
  }

  /** 把第 index 个成员写进对应队形槽位（就地写值，不 new） */
  private writeSlot(
    slot: pc.Vec3,
    index: number,
    total: number,
    anchor: pc.Vec3,
    forward: pc.Vec3,
    flatForward: pc.Vec3,
    right: pc.Vec3,
    formation: FormationType,
  ): void {
    if (formation === 'circle') {
      // 水平环：以 anchor 为圆心，forward 为 0°，y 与 anchor 齐平
      const angle = total > 0 ? (Math.PI * 2 * index) / total : 0;
      const cos = Math.cos(angle) * CIRCLE_RADIUS;
      const sin = Math.sin(angle) * CIRCLE_RADIUS;
      slot.set(
        anchor.x + flatForward.x * cos + right.x * sin,
        anchor.y,
        anchor.z + flatForward.z * cos + right.z * sin,
      );
      return;
    }

    if (formation === 'column') {
      // 纵队：沿 -forward 依次排队
      const depth = -COLUMN_SPACING * (index + 1);
      slot.set(
        anchor.x + forward.x * depth,
        anchor.y + forward.y * depth,
        anchor.z + forward.z * depth,
      );
      return;
    }

    // 楔形：首槽 anchor + forward*8，之后左右交替、每级后退 2.5
    if (index === 0) {
      slot.set(
        anchor.x + forward.x * WEDGE_FORWARD,
        anchor.y + forward.y * WEDGE_FORWARD,
        anchor.z + forward.z * WEDGE_FORWARD,
      );
      return;
    }
    const level = Math.ceil(index / 2);
    const side = index % 2 === 1 ? -1 : 1;
    const depth = WEDGE_FORWARD - WEDGE_BACK_STEP * level;
    const lateral = side * SPACING * level;
    slot.set(
      anchor.x + forward.x * depth + right.x * lateral,
      anchor.y + forward.y * depth + right.y * lateral,
      anchor.z + forward.z * depth + right.z * lateral,
    );
  }
}

function clampWeight(value: unknown): number {
  const num = typeof value === 'number' && Number.isFinite(value) ? value : MIN_WEIGHT;
  return Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, num));
}

function vectorLengthSq(vec: pc.Vec3): number {
  return vec.x * vec.x + vec.y * vec.y + vec.z * vec.z;
}

function normalizeThreat(value: unknown): 0 | 1 | 2 {
  if (value === 1) return 1;
  if (value === 2) return 2;
  return 0;
}

function isFormationType(value: unknown): value is FormationType {
  return value === 'wedge' || value === 'circle' || value === 'column';
}
