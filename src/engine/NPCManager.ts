import * as pc from 'playcanvas';
import { PlayCanvasGameEngine } from './PlayCanvasEngine';
import { PlayerShip } from './PlayerShip';
import { FactionId, FactionManager } from './FactionManager';
import { useGameStore } from '../store/useGameStore';
import { enemyAIManager } from '../lua/ai/EnemyAIManager';

export enum NPCBehavior {
  IDLE,
  PATROL,
  FOLLOW,
  ATTACK,
  TRADE,
  FLANK, // 2026 Tech: 侧翼包抄
  FORM_UP, // 2026 Tech: 编队集结
  ESCORT, // 2026 Tech: 护送任务目标
  SWARM // 2026 Tech: 蜂群冲锋行为
}

export enum SquadState {
  IDLE,
  TRAVEL,
  COMBAT,
  RETREAT
}

/** 2026 Tech: NPC 战术小组 */
export class Squad {
  public id: string;
  public leader: NPC | null = null;
  public members: NPC[] = [];
  public formationType: 'v' | 'line' | 'circle' = 'v';
  public factionId: FactionId;
  public state: SquadState = SquadState.IDLE;

  constructor(id: string, factionId: FactionId) {
    this.id = id;
    this.factionId = factionId;
  }

  public setFormation(type: 'v' | 'line' | 'circle'): void {
    this.formationType = type;
  }

  public setState(state: SquadState): void {
    this.state = state;
  }

  public addMember(npc: NPC): void {
    if (!this.leader) this.leader = npc;
    this.members.push(npc);
    npc.setSquad(this);
  }

  public getFormationOffset(npc: NPC): pc.Vec3 {
    const index = this.members.indexOf(npc);
    if (index <= 0) return new pc.Vec3(0, 0, 0);

    const side = index % 2 === 0 ? 1 : -1;
    const row = Math.ceil(index / 2);

    switch (this.formationType) {
      case 'v':
        return new pc.Vec3(side * 5 * row, 0, 5 * row);
      case 'line':
        return new pc.Vec3(side * 6 * row, 0, 0);
      case 'circle':
        const angle = (index / Math.max(1, this.members.length)) * Math.PI * 2;
        const radius = 15;
        return new pc.Vec3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      default:
        return new pc.Vec3(0, 0, 0);
    }
  }
}

export class NPC {
  private entity: pc.Entity;
  private factionId: FactionId;
  private behavior: NPCBehavior = NPCBehavior.PATROL;
  private target: pc.Vec3 | null = null;
  private speed: number = 5.0;
  private engine: PlayCanvasGameEngine;
  private player: PlayerShip;
  private hasHailed: boolean = false;
  private squad: Squad | null = null;
  private flankAngle: number = 0;
  private luaHandle: number = -1;
  private health: number = 100;
  private maxHealth: number = 100;

  private trailEntity: pc.Entity | null = null;

  constructor(engine: PlayCanvasGameEngine, player: PlayerShip, factionId: FactionId, position: pc.Vec3) {
    this.engine = engine;
    this.player = player;
    this.factionId = factionId;
    
    this.entity = new pc.Entity(`npc_${factionId}`);
    this.entity.setPosition(position);
    
    // 使用占位模型
    const model = new pc.Entity('model');
    model.addComponent('model', { type: 'cone' });
    this.entity.addChild(model);
    
    // 设置派系颜色
    const factionManager = (this.engine.getApp() as any)._factionManager as FactionManager;
    const faction = factionManager?.getFaction(factionId);
    if (faction && model.model) {
      const mat = new pc.StandardMaterial();
      mat.diffuse.set(faction.color[0], faction.color[1], faction.color[2]);
      mat.update();
      model.model.material = mat;
    }

    this.engine.addToScene(this.entity);
    this.setupTrail(faction?.color || [1, 1, 1]);
  }

  private setupTrail(color: [number, number, number]): void {
    this.trailEntity = new pc.Entity('npc_trail');
    this.engine.addParticleSystem(this.trailEntity, {
      lifetime: 0.5,
      numParticles: 20,
      initialVelocity: 0,
      colorGraph: new pc.CurveSet([[color[0], color[1], color[2]], [0, 0, 0]]),
      scaleGraph: new pc.Curve([0.3, 0.1, 0])
    });
    this.entity.addChild(this.trailEntity);
    this.trailEntity.enabled = false; // 默认关闭，仅在 SWARM 时开启
  }

  public setSquad(squad: Squad): void {
    this.squad = squad;
  }

  public getPosition(): pc.Vec3 {
    return this.entity.getPosition();
  }

  public update(dt: number): void {
    const playerPos = this.player.getPosition();
    const distToPlayer = this.entity.getPosition().distance(playerPos);

    // 2026 Tech: 星云隐身影响 (Radar Signal Decay)
    const sectorManager = (this.engine.getApp() as any)._sectorManager;
    const isPlayerInNebula = sectorManager?.isInNebula() || false;
    
    // 如果玩家在星云中，探测距离大幅下降；如果 NPC 也在星云中，视野几乎丧失
    let detectionRange = 40;
    if (isPlayerInNebula) {
      detectionRange = 15; // 基础隐身
      
      // 如果 NPC 不在星云中，很难看到里面的玩家
      const npcPos = this.entity.getPosition();
      const nebulaEntity = sectorManager?.getNearestNebula(npcPos);
      if (nebulaEntity) {
        const npcDistToNebula = npcPos.distance(nebulaEntity.getPosition());
        if (npcDistToNebula > nebulaEntity.getLocalScale().x * 0.5) {
          detectionRange = 8; // 从外部探测星云内目标极其困难
        }
      }
    }

    // 2026 Tech: Neural AI 决策逻辑
    const factionManager = (this.engine.getApp() as any)._factionManager as FactionManager;
    const reputation = factionManager?.getFaction(this.factionId)?.reputation || 0;

    if (distToPlayer < detectionRange && !this.hasHailed) {
      this.hailPlayer(reputation);
    }

    if (reputation < -50 && distToPlayer < detectionRange * 1.5) {
      // 战术选择：如果有队友且是攻击状态，尝试包抄
      if (this.squad && this.squad.leader !== this) {
        this.behavior = NPCBehavior.FLANK;
      } else {
        this.behavior = NPCBehavior.ATTACK;
      }
    } else if (distToPlayer < 15 && reputation > 20) {
      this.behavior = NPCBehavior.TRADE;
    } else if (this.squad && this.squad.leader !== this) {
      this.behavior = NPCBehavior.FORM_UP;
    } else {
      this.behavior = NPCBehavior.PATROL;
    }

    // 2026 Tech: Lua AI Integration
    let luaSuccess = false;
    if (enemyAIManager.isReady()) {
      const pos = this.entity.getPosition();
      
      // 如果行为发生重大变化（如进入 SWARM），重新生成 Lua 句柄以匹配 AI 类型
      const targetLuaType = (this.behavior as NPCBehavior) === NPCBehavior.SWARM ? 'SWARM' : 
                            this.behavior === NPCBehavior.ATTACK ? 'AGGRESSIVE' : 'PATROL';
      
      if (this.luaHandle === -1) {
        this.luaHandle = enemyAIManager.spawn(
          targetLuaType, pos.x, pos.y, pos.z, 
          this.health, this.maxHealth, detectionRange
        );
      }

      if (this.luaHandle !== -1) {
        enemyAIManager.sync(this.luaHandle, pos.x, pos.y, pos.z, this.health);
        const result = enemyAIManager.step(
          this.luaHandle, playerPos.x, playerPos.y, playerPos.z, dt
        );
        
        if (result) {
          // 应用 Lua 算出的位移和状态
          this.entity.setPosition(result.x, result.y, result.z);
          if (result.action) {
            console.log(`[Lua AI Action] NPC ${this.factionId}: ${result.action}`);
          }
          luaSuccess = true;
        }
      }
    }

    // 2026 Tech: 视觉反馈 (Visual Feedback)
    if (this.trailEntity) {
      this.trailEntity.enabled = (this.behavior as NPCBehavior) === NPCBehavior.SWARM || this.behavior === NPCBehavior.FLANK;
    }

    if (!luaSuccess) {
      this.executeBehavior(dt, playerPos);
    }
  }

  private hailPlayer(reputation: number): void {
    this.hasHailed = true;
    let message = '';
    if (reputation > 50) message = "很高兴见到你，盟友。这里有一些多余的补给，请收下。";
    else if (reputation < -50) message = "由于你的敌对行为，我们将采取强制措施。准备迎战！";
    else message = "不明飞行物，请保持距离。我们正在执行巡逻任务。";

    console.log(`[NPC ${this.factionId}] Hailing: ${message}`);
    
    // 2026 Tech: 触发全局对话 UI
    useGameStore.getState().setActiveDialogue({
      id: `hail_${this.factionId}_${Date.now()}`,
      name: '通讯请求',
      participants: [this.factionId, 'player'],
      trigger: { type: 'auto' },
      lines: [
        {
          speaker: this.factionId === 'trade_union' ? 'operator' : 'unknown',
          text: message,
          emotion: reputation < -50 ? 'urgent' : 'neutral'
        }
      ]
    });
  }

  private executeBehavior(dt: number, playerPos: pc.Vec3): void {
    const currentPos = this.entity.getPosition();
    
    if (this.behavior === NPCBehavior.ATTACK) {
      const dir = playerPos.clone().sub(currentPos).normalize();
      this.entity.translate(dir.scale(this.speed * dt));
      this.entity.lookAt(playerPos);
    } else if (this.behavior === NPCBehavior.FLANK) {
      // 2026 Tech: 侧翼包抄算法优化
      // 1. 计算玩家的侧向向量 (Right vector)
      const playerForward = this.player.getForward();
      const up = new pc.Vec3(0, 1, 0);
      const playerRight = new pc.Vec3().cross(playerForward, up).normalize();
      
      // 2. 根据 index 决定包抄方向 (左侧或右侧)
      const index = this.squad ? this.squad.members.indexOf(this) : 1;
      const side = index % 2 === 0 ? 1 : -1;
      
      // 3. 计算侧翼目标点：在玩家侧方一定距离，并带有一点滞后
      this.flankAngle += dt * 0.3; // 缓慢变化以增加不可预测性
      const orbitOffset = side * (25 + Math.sin(this.flankAngle) * 5);
      const behindOffset = 10 + Math.cos(this.flankAngle) * 5;
      
      const targetPos = playerPos.clone()
        .add(playerRight.clone().scale(orbitOffset))
        .add(playerForward.clone().scale(behindOffset));
      
      // 4. 平滑趋近目标点
      const dir = targetPos.sub(currentPos).normalize();
      const dist = currentPos.distance(targetPos);
      
      // 靠近目标时加速，远离时维持速度
      const speedMult = dist > 10 ? 1.5 : 1.0;
      this.entity.translate(dir.scale(this.speed * speedMult * dt));
      
      // 始终盯着玩家
      this.entity.lookAt(playerPos);
      
      // 5. 2026 Tech: 简单的规避动作 (Evasive Maneuvers)
      if (dist < 15) {
        const jitter = new pc.Vec3(
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2,
          (Math.random() - 0.5) * 2
        );
        this.entity.translate(jitter.scale(dt));
      }
    } else if (this.behavior === NPCBehavior.FORM_UP && this.squad && this.squad.leader) {
      // 2026 Tech: 编队逻辑
      const leaderPos = this.squad.leader.getPosition();
      const offset = this.squad.getFormationOffset(this);
      const targetPos = leaderPos.clone().add(offset);
      const dir = targetPos.sub(currentPos).normalize();
      const dist = currentPos.distance(targetPos);
      
      if (dist > 1.0) {
        this.entity.translate(dir.scale(this.speed * dt));
      }
      this.entity.lookAt(playerPos);
    } else if (this.behavior === NPCBehavior.PATROL) {
      // 简单的随机巡逻逻辑
      if (!this.target || currentPos.distance(this.target) < 5) {
        this.target = new pc.Vec3(
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 20,
          (Math.random() - 0.5) * 100
        );
      }
      const dir = this.target.clone().sub(currentPos).normalize();
      this.entity.translate(dir.scale(this.speed * 0.5 * dt));
      this.entity.lookAt(this.target);
    } else if (this.behavior === NPCBehavior.ESCORT) {
      // 2026 Tech: 护送目标移动逻辑
      // 目标点通常是星区的跃迁门或空间站
      if (!this.target) {
        this.target = new pc.Vec3(0, 0, -200); // 默认向深空移动
      }
      
      const dir = this.target.clone().sub(currentPos).normalize();
      const dist = currentPos.distance(this.target);
      
      if (dist > 5.0) {
        // 护送目标速度较慢，且会等待玩家
        const playerDist = currentPos.distance(playerPos);
        const waitMult = playerDist > 50 ? 0.2 : 1.0; 
        
        this.entity.translate(dir.scale(this.speed * 0.6 * waitMult * dt));
        this.entity.lookAt(this.target);
        
        // 如果玩家离得太远，在通讯频道提醒
        if (playerDist > 60 && Math.random() > 0.99) {
          console.log(`[NPC ${this.factionId}] 你离得太远了，请回到护送位置！`);
        }
      } else {
        // 到达目的地，任务目标达成
        const storyMgr = (this.engine.getApp() as any)._storyManager as import('./StoryMissionManager').StoryMissionManager;
        if (storyMgr) {
          storyMgr.incrementObjective('escort_merchant', 'escort', 1);
        }
      }
    } else if (this.behavior === NPCBehavior.SWARM) {
      // 2026 Tech: 进化版蜂群攻击逻辑 (Swarm Intelligence)
      const dir = playerPos.clone().sub(currentPos).normalize();
      const dist = currentPos.distance(playerPos);
      
      // 蜂群冲锋速度受生命值影响：生命越低，越疯狂 (Kamikaze 倾向)
      const healthFactor = this.health / this.maxHealth;
      const swarmSpeed = this.speed * (1.8 + (1 - healthFactor) * 1.2);
      
      // 2026 Tech: 螺旋式接近 (Spiral Approach)
      // 相比于直线冲锋，螺旋式更难被击中
      const time = Date.now() * 0.005;
      const angle = time * 2 + (this.entity.getGuid().length % 10);
      const radius = dist > 20 ? 10 * healthFactor : 2;
      
      const spiralOffset = new pc.Vec3(
        Math.cos(angle) * radius,
        Math.sin(angle * 0.5) * radius,
        Math.sin(angle) * radius
      );
      
      // 基础位移 + 螺旋偏移
      const moveVec = dir.scale(swarmSpeed * dt).add(spiralOffset.scale(dt));
      this.entity.translate(moveVec);
      
      // 冲锋时不断旋转以增加视觉干扰，低血量时旋转极快
      const rotSpeed = 500 + (1 - healthFactor) * 1000;
      this.entity.rotate(0, 0, dt * rotSpeed);
      this.entity.lookAt(playerPos);
      
      if (dist < 5.0) {
        // 近身干扰：模拟电子干扰
        if (Math.random() > 0.95) {
          console.log(`[NPC ${this.factionId}] Swarm static interference...`);
          const store = (window as any).useGameStore?.getState();
          // 2026 Tech: 触发 UI 抖动或干扰反馈
          store?.updateGalacticStatus({ 
            intelligenceFeed: [
              ...store.galacticStatus.intelligenceFeed.slice(-4),
              `[WARNING] 局部电子干扰：来自 ${this.factionId} 蜂群`
            ]
          });
        }
      }
      
      if (dist < 2.0 && healthFactor < 0.2) {
        // 极低血量自毁倾向
        console.log(`[NPC ${this.factionId}] Initiating Kamikaze dive!`);
        this.takeDamage(100); // 自毁
        // 对玩家造成伤害逻辑通常由 WeaponSystem 或碰撞系统处理，此处仅标记行为
      }
    }
  }

  public setBehavior(behavior: NPCBehavior, target?: pc.Vec3): void {
    this.behavior = behavior;
    if (target) this.target = target;
  }

  public takeDamage(amount: number): void {
    this.health -= amount;
    console.log(`[NPC ${this.factionId}] Taking damage: ${amount}. Health: ${this.health}`);
    
    if (this.health <= 0) {
      this.health = 0;
      // 触发销毁逻辑
      this.destroy();
    }
  }

  public destroy(): void {
    if (this.luaHandle !== -1) {
      enemyAIManager.despawn(this.luaHandle);
      this.luaHandle = -1;
    }
    this.entity.destroy();
  }
}

export class NPCManager {
  private engine: PlayCanvasGameEngine;
  private player: PlayerShip;
  private npcs: NPC[] = [];
  private squads: Squad[] = [];

  constructor(engine: PlayCanvasGameEngine, player: PlayerShip) {
    this.engine = engine;
    this.player = player;
  }

  public spawnNPC(factionId: FactionId, position: pc.Vec3, squadId?: string): NPC {
    const npc = new NPC(this.engine, this.player, factionId, position);
    this.npcs.push(npc);

    if (squadId) {
      let squad = this.squads.find(s => s.id === squadId);
      if (!squad) {
        squad = new Squad(squadId, factionId);
        this.squads.push(squad);
      }
      squad.addMember(npc);
    }
    return npc;
  }

  public spawnSquad(factionId: FactionId, leaderPos: pc.Vec3, memberCount: number): void {
    const squadId = `squad_${factionId}_${Date.now()}`;
    this.spawnNPC(factionId, leaderPos, squadId);
    
    for (let i = 0; i < memberCount; i++) {
      const offset = new pc.Vec3((Math.random() - 0.5) * 20, 0, (Math.random() - 0.5) * 20);
      this.spawnNPC(factionId, leaderPos.clone().add(offset), squadId);
    }
  }

  public update(dt: number): void {
    // 2026 Tech: 清理已销毁的 NPC
    this.npcs = this.npcs.filter(npc => (npc as any).entity?.enabled !== false && (npc as any).health > 0);

    // 2026 Tech: 集群战术决策 (Swarm Tactical Decision)
    this.squads.forEach(squad => {
      // 移除已销毁的成员
      squad.members = squad.members.filter(m => this.npcs.includes(m));
      this.updateSquadTactics(squad);
    });

    this.npcs.forEach(npc => npc.update(dt));
  }

  private updateSquadTactics(squad: Squad): void {
    if (squad.members.length === 0) return;

    // 如果领队阵亡，选举新领队
    if (!squad.leader || !this.npcs.includes(squad.leader)) {
      squad.leader = squad.members[0];
    }

    // 2026 Tech: 动态战术调整
    const playerPos = this.player.getPosition();
    const distToPlayer = squad.leader.getPosition().distance(playerPos);

    // 获取派系声望
    const factionManager = (this.engine.getApp() as any)._factionManager as FactionManager;
    const reputation = factionManager?.getFaction(squad.factionId)?.reputation || 0;

    if (reputation < -50) {
      if (distToPlayer > 80) {
        // 远程接近：长龙阵，快速推进
        squad.setState(SquadState.TRAVEL);
        squad.setFormation('line');
        squad.members.forEach(m => m.setBehavior(NPCBehavior.FORM_UP));
      } else if (distToPlayer > 40) {
        // 进入战斗半径：V字阵，准备突击
        squad.setState(SquadState.COMBAT);
        squad.setFormation('v');
        squad.members.forEach(m => m.setBehavior(NPCBehavior.FORM_UP));
      } else {
        // 近距交火：环绕阵，协同围攻
        squad.setState(SquadState.COMBAT);
        squad.setFormation('circle');
        
        squad.members.forEach((member, index) => {
          if (member === squad.leader) {
            // 领队正面吸引火力
            member.setBehavior(NPCBehavior.ATTACK);
          } else if (index % 3 === 0) {
            // 部分成员执行高危蜂群冲锋
            member.setBehavior(NPCBehavior.SWARM);
          } else {
            // 其余成员侧翼袭扰
            member.setBehavior(NPCBehavior.FLANK);
          }
        });
      }
    } else {
      // 非敌对状态：保持巡逻或跟随领队
      squad.setState(SquadState.IDLE);
      squad.setFormation('v');
      squad.members.forEach(m => {
        if (m !== squad.leader) m.setBehavior(NPCBehavior.FORM_UP);
      });
    }
  }

  public getNPCs(): NPC[] {
    return this.npcs;
  }

  public clear(): void {
    this.npcs.forEach(npc => npc.destroy());
    this.npcs = [];
    this.squads = [];
  }
}
