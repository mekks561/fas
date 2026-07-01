/**
 * 剧情任务管理器
 * 管理故事章节、任务系统和对话的加载与状态追踪
 */

export interface StoryChapter {
  id: string;
  number: number;
  title: string;
  titleEn: string;
  description: string;
  background: string;
  dialogueSequence: DialogueLine[];
  objectives: string[];
  rewards: ChapterRewards;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  emotion: string;
  portrait?: string;
}

export interface ChapterRewards {
  experience: number;
  credits: number;
  unlocks: string[];
  achievement?: string;
}

export interface Mission {
  id: string;
  name: string;
  description: string;
  type: 'main' | 'side' | 'daily';
  category: 'destroy' | 'escort' | 'collect' | 'survive' | 'boss';
  objectives: MissionObjective[];
  rewards: MissionRewards;
  prerequisites: string[];
  chapter?: string;
}

export interface MissionObjective {
  type: 'destroy' | 'survive' | 'escort' | 'collect' | 'reach';
  target?: string;
  count?: number;
  duration?: number;
  current: number;
  completed: boolean;
}

export interface MissionRewards {
  experience: number;
  credits: number;
  items: string[];
}

export interface Dialogue {
  id: string;
  name: string;
  participants: string[];
  trigger: DialogueTrigger;
  lines: DialogueLine[];
}

export interface DialogueTrigger {
  type: 'story' | 'mission' | 'interaction' | 'auto';
  chapter?: string;
  mission?: string;
  stage?: string;
}

export type MissionStatus = 'locked' | 'available' | 'active' | 'completed' | 'failed';

export interface MissionState {
  mission: Mission;
  status: MissionStatus;
  objectives: MissionObjective[];
}

export class StoryMissionManager {
  private chapters: Map<string, StoryChapter> = new Map();
  private missions: Map<string, Mission> = new Map();
  private dialogues: Map<string, Dialogue> = new Map();
  private missionStates: Map<string, MissionState> = new Map();
  private currentChapterId: string | null = null;
  private activeMissionIds: Set<string> = new Set();
  private completedMissionIds: Set<string> = new Set();
  private listeners: Set<() => void> = new Set();

  /** 加载所有剧情资源 */
  async loadAll(): Promise<void> {
    await Promise.all([
      this.loadChapters(),
      this.loadMissions(),
      this.loadDialogues(),
    ]);
    this.updateMissionAvailability();
    console.log('[StoryMissionManager] Loaded:', {
      chapters: this.chapters.size,
      missions: this.missions.size,
      dialogues: this.dialogues.size,
    });
  }

  private async loadChapters(): Promise<void> {
    for (let i = 1; i <= 5; i++) {
      const id = `story-chapter-${String(i).padStart(2, '0')}`;
      try {
        const resp = await fetch(`/assets/story/${id}.json`);
        if (resp.ok) {
          const chapter: StoryChapter = await resp.json();
          this.chapters.set(chapter.id, chapter);
        }
      } catch (e) {
        console.warn(`[StoryMissionManager] Failed to load chapter ${id}`, e);
      }
    }
  }

  private async loadMissions(): Promise<void> {
    for (let i = 1; i <= 20; i++) {
      const id = `mission-${String(i).padStart(2, '0')}`;
      try {
        const resp = await fetch(`/assets/missions/${id}.json`);
        if (resp.ok) {
          const mission: Mission = await resp.json();
          this.missions.set(mission.id, mission);
          this.missionStates.set(mission.id, {
            mission,
            status: 'locked',
            objectives: mission.objectives.map(o => ({ ...o, completed: false })),
          });
        }
      } catch (e) {
        console.warn(`[StoryMissionManager] Failed to load mission ${id}`, e);
      }
    }
  }

  private async loadDialogues(): Promise<void> {
    for (let i = 1; i <= 10; i++) {
      const id = `dialogue-${String(i).padStart(2, '0')}`;
      try {
        const resp = await fetch(`/assets/dialogues/${id}.json`);
        if (resp.ok) {
          const dialogue: Dialogue = await resp.json();
          this.dialogues.set(dialogue.id, dialogue);
        }
      } catch (e) {
        console.warn(`[StoryMissionManager] Failed to load dialogue ${id}`, e);
      }
    }
  }

  // ============ 章节管理 ============

  getChapter(chapterId: string): StoryChapter | undefined {
    return this.chapters.get(chapterId);
  }

  getAllChapters(): StoryChapter[] {
    return Array.from(this.chapters.values()).sort((a, b) => a.number - b.number);
  }

  setCurrentChapter(chapterId: string): void {
    this.currentChapterId = chapterId;
    this.notify();
  }

  getCurrentChapter(): StoryChapter | null {
    return this.currentChapterId ? this.chapters.get(this.currentChapterId) || null : null;
  }

  // ============ 任务管理 ============

  getMission(missionId: string): Mission | undefined {
    return this.missions.get(missionId);
  }

  getMissionState(missionId: string): MissionState | undefined {
    return this.missionStates.get(missionId);
  }

  getAllMissions(): Mission[] {
    return Array.from(this.missions.values());
  }

  getActiveMissions(): MissionState[] {
    return Array.from(this.missionStates.values()).filter(s => s.status === 'active');
  }

  getAvailableMissions(): MissionState[] {
    return Array.from(this.missionStates.values()).filter(s => s.status === 'available');
  }

  startMission(missionId: string): boolean {
    const state = this.missionStates.get(missionId);
    if (!state || state.status !== 'available') return false;

    state.status = 'active';
    this.activeMissionIds.add(missionId);
    this.notify();
    console.log(`[StoryMissionManager] Mission started: ${missionId}`);
    return true;
  }

  /** 更新任务目标进度 */
  updateObjective(missionId: string, objectiveIndex: number, progress: number): void {
    const state = this.missionStates.get(missionId);
    if (!state || state.status !== 'active') return;

    const obj = state.objectives[objectiveIndex];
    if (!obj || obj.completed) return;

    if (obj.type === 'destroy' || obj.type === 'collect') {
      obj.current = Math.min(obj.count || 0, progress);
      if (obj.current >= (obj.count || 0)) {
        obj.completed = true;
      }
    } else if (obj.type === 'survive') {
      obj.current = Math.min(obj.duration || 0, progress);
      if (obj.current >= (obj.duration || 0)) {
        obj.completed = true;
      }
    }

    this.checkMissionComplete(missionId);
    this.notify();
  }

  /** 增量更新任务目标 */
  incrementObjective(missionId: string, objectiveType: string, amount: number = 1): void {
    const state = this.missionStates.get(missionId);
    if (!state || state.status !== 'active') return;

    const obj = state.objectives.find(o => o.type === objectiveType && !o.completed);
    if (!obj) return;

    obj.current += amount;
    if (obj.type === 'destroy' && obj.current >= (obj.count || 0)) {
      obj.completed = true;
    } else if (obj.type === 'survive' && obj.current >= (obj.duration || 0)) {
      obj.completed = true;
    }

    this.checkMissionComplete(missionId);
    this.notify();
  }

  private checkMissionComplete(missionId: string): void {
    const state = this.missionStates.get(missionId);
    if (!state || state.status !== 'active') return;

    const allComplete = state.objectives.every(o => o.completed);
    if (allComplete) {
      state.status = 'completed';
      this.activeMissionIds.delete(missionId);
      this.completedMissionIds.add(missionId);
      this.updateMissionAvailability();
      console.log(`[StoryMissionManager] Mission completed: ${missionId}`);
    }
  }

  private updateMissionAvailability(): void {
    this.missionStates.forEach((state, missionId) => {
      if (state.status !== 'locked') return;

      const prereqs = state.mission.prerequisites;
      if (prereqs.length === 0) {
        state.status = 'available';
        return;
      }

      const allPrereqsMet = prereqs.every(p => this.completedMissionIds.has(p));
      if (allPrereqsMet) {
        state.status = 'available';
      }
    });
  }

  // ============ 对话管理 ============

  getDialogue(dialogueId: string): Dialogue | undefined {
    return this.dialogues.get(dialogueId);
  }

  getDialogueByTrigger(triggerType: string, chapter?: string, stage?: string): Dialogue | undefined {
    return Array.from(this.dialogues.values()).find(d => {
      if (d.trigger.type !== triggerType) return false;
      if (chapter && d.trigger.chapter !== chapter) return false;
      if (stage && d.trigger.stage !== stage) return false;
      return true;
    });
  }

  getAllDialogues(): Dialogue[] {
    return Array.from(this.dialogues.values());
  }

  // ============ 事件订阅 ============

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify(): void {
    this.listeners.forEach(cb => cb());
  }

  // ============ 统计信息 ============

  getProgressStats() {
    const total = this.missionStates.size;
    const completed = this.completedMissionIds.size;
    const active = this.activeMissionIds.size;
    const available = this.getAvailableMissions().length;
    return { total, completed, active, available };
  }
}
