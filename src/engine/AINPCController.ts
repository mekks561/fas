import * as pc from 'playcanvas';

export interface NPCState {
  position: pc.Vec3;
  velocity: pc.Vec3;
  health: number;
  maxHealth: number;
  level: number;
  behavior: 'idle' | 'patrol' | 'chase' | 'attack' | 'flee';
  targetPosition: pc.Vec3;
  nearestEnemy: string | null;
}

export interface NPCAction {
  type: 'move' | 'attack' | 'rotate' | 'shoot' | 'strafe' | 'flee' | 'chase';
  direction?: pc.Vec3;
  target?: pc.Vec3;
  speed?: number;
  duration?: number;
}

export interface AIModelConfig {
  modelPath: string;
  inputSize: number;
  outputSize: number;
  decisionInterval: number;
  maxInferenceTime: number;
}

interface ONNXTensorLike {
  data: number[];
}

interface ONNXResultLike {
  output?: ONNXTensorLike;
  [key: string]: ONNXTensorLike | undefined;
}

interface ONNXSessionLike {
  run(feeds: Record<string, ONNXTensorLike>): Promise<ONNXResultLike>;
}

interface ONNXRuntimeLike {
  InferenceSession: {
    create: (data: Uint8Array, options: { executionProviders: string[] }) => Promise<ONNXSessionLike>;
  };
  Tensor: new (type: string, data: number[], dims: number[]) => ONNXTensorLike;
}

export class AINPCController {
  private npcStates: Map<string, NPCState> = new Map();
  private session: ONNXSessionLike | null = null;
  private config: AIModelConfig;
  private lastDecisionTime: number = 0;
  private modelLoaded: boolean = false;
  private useAI: boolean = true;

  constructor(config: Partial<AIModelConfig> = {}) {
    this.config = {
      modelPath: '/models/npc_ai.onnx',
      inputSize: 16,
      outputSize: 5,
      decisionInterval: 100,
      maxInferenceTime: 50,
      ...config,
    };

    this.tryLoadModel();
  }

  private async tryLoadModel(): Promise<void> {
    try {
      const ort = await this.loadONNX();
      if (!ort) {
        console.warn('ONNX Runtime not available, using rule-based AI');
        this.useAI = false;
        return;
      }

      const response = await fetch(this.config.modelPath);
      if (!response.ok) {
        throw new Error(`Failed to load model: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const modelData = new Uint8Array(arrayBuffer);

      this.session = await ort.InferenceSession.create(modelData, {
        executionProviders: ['webgl', 'wasm'],
      });

      this.modelLoaded = true;
      console.log('AI model loaded successfully');
    } catch (error) {
      console.warn('AI model loading failed:', error);
      this.useAI = false;
    }
  }

  private async loadONNX(): Promise<ONNXRuntimeLike | null> {
    try {
      if (typeof window !== 'undefined' && (window as unknown as { onnx?: ONNXRuntimeLike }).onnx) {
        return (window as unknown as { onnx?: ONNXRuntimeLike }).onnx ?? null;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort.min.js';
      script.async = true;

      return new Promise((resolve, reject) => {
        script.onload = () => resolve((window as unknown as { onnx?: ONNXRuntimeLike }).onnx ?? null);
        script.onerror = () => reject(new Error('Failed to load ONNX Runtime'));
        document.head.appendChild(script);
      });
    } catch {
      return null;
    }
  }

  public createNPC(npcId: string, initialState: Partial<NPCState>): void {
    const state: NPCState = {
      position: new pc.Vec3(0, 0, 0),
      velocity: new pc.Vec3(0, 0, 0),
      health: 100,
      maxHealth: 100,
      level: 1,
      behavior: 'idle',
      targetPosition: new pc.Vec3(0, 0, 0),
      nearestEnemy: null,
      ...initialState,
    };
    this.npcStates.set(npcId, state);
  }

  public updateNPC(npcId: string, state: Partial<NPCState>): void {
    const existingState = this.npcStates.get(npcId);
    if (existingState) {
      Object.assign(existingState, state);
    }
  }

  public update(_dt: number, playerPositions: Map<string, pc.Vec3>): Map<string, NPCAction> {
    const actions = new Map<string, NPCAction>();
    const now = Date.now();

    if (now - this.lastDecisionTime >= this.config.decisionInterval) {
      this.lastDecisionTime = now;

      for (const [npcId, state] of this.npcStates) {
        const action = this.useAI ? this.decideWithRules(state, playerPositions) : this.decideWithRules(state, playerPositions);
        if (action) {
          actions.set(npcId, action);
        }
      }
    }

    this.updateAIAsync(playerPositions);

    return actions;
  }

  private async updateAIAsync(playerPositions: Map<string, pc.Vec3>): Promise<void> {
    if (!this.useAI) return;

    for (const [npcId, state] of this.npcStates) {
      try {
        const action = await this.decideWithAI(state, playerPositions);
        if (action) {
          const actionMap = new Map<string, NPCAction>();
          actionMap.set(npcId, action);
        }
      } catch (error) {
        console.warn('AI update error:', error);
      }
    }
  }

  private async decideWithAI(state: NPCState, playerPositions: Map<string, pc.Vec3>): Promise<NPCAction | null> {
    if (!this.modelLoaded || !this.session) {
      return this.decideWithRules(state, playerPositions);
    }

    try {
      const inputData = this.prepareInput(state, playerPositions);
      const tensor = new (window as unknown as { onnx: ONNXRuntimeLike }).onnx.Tensor('float32', inputData, [1, this.config.inputSize]);

      const start = performance.now();
      const results = await this.session.run({ input: tensor });
      const inferenceTime = performance.now() - start;

      if (inferenceTime > this.config.maxInferenceTime) {
        console.warn(`AI inference time exceeded: ${inferenceTime}ms`);
      }

      const output = results.output?.data || results[0]?.data;
      if (!output) {
        return this.decideWithRules(state, playerPositions);
      }

      const actionIndex = this.argMax(output);
      
      const nearestPlayer = this.findNearestPlayer(state.position, playerPositions);
      if (nearestPlayer) {
        const distance = state.position.distance(nearestPlayer.position);
        const healthRatio = state.health / state.maxHealth;
        
        if (distance > 25) {
          return this.getPatrolAction(state);
        }
        
        if (healthRatio < 0.3) {
          const fleeDirection = new pc.Vec3().sub2(state.position, nearestPlayer.position).normalize();
          return { type: 'flee', direction: fleeDirection, speed: 4 };
        }
      }
      
      return this.convertOutputToAction(actionIndex, state, playerPositions);
    } catch (error) {
      console.warn('AI decision error:', error);
      return this.decideWithRules(state, playerPositions);
    }
  }

  private decideWithRules(state: NPCState, playerPositions: Map<string, pc.Vec3>): NPCAction {
    const nearestPlayer = this.findNearestPlayer(state.position, playerPositions);
    
    if (!nearestPlayer) {
      return this.getPatrolAction(state);
    }

    const distance = state.position.distance(nearestPlayer.position);
    const healthRatio = state.health / state.maxHealth;

    if (healthRatio < 0.3) {
      const fleeDirection = new pc.Vec3().sub2(state.position, nearestPlayer.position).normalize();
      return { type: 'flee', direction: fleeDirection, speed: 4 };
    }

    if (distance < 5) {
      return { type: 'attack', target: nearestPlayer.position };
    }

    if (distance < 20) {
      return { type: 'chase', target: nearestPlayer.position, speed: 3 };
    }

    if (distance > 30) {
      return this.getPatrolAction(state);
    }

    return this.getPatrolAction(state);
  }

  private getPatrolAction(state: NPCState): NPCAction {
    const distanceToTarget = state.position.distance(state.targetPosition);
    
    if (distanceToTarget < 2) {
      const angle = Math.random() * Math.PI * 2;
      state.targetPosition = new pc.Vec3(
        state.position.x + Math.cos(angle) * 10,
        state.position.y,
        state.position.z + Math.sin(angle) * 10
      );
    }

    const direction = new pc.Vec3().sub2(state.targetPosition, state.position).normalize();
    return { type: 'move', direction, speed: 1.5 };
  }

  private prepareInput(state: NPCState, playerPositions: Map<string, pc.Vec3>): number[] {
    const input: number[] = [];
    const nearestPlayer = this.findNearestPlayer(state.position, playerPositions);
    const healthRatio = state.health / state.maxHealth;
    let distance = nearestPlayer ? state.position.distance(nearestPlayer.position) : 100;

    input.push(state.position.x, state.position.y, state.position.z);
    input.push(state.velocity.x, state.velocity.y, state.velocity.z);
    input.push(healthRatio);
    input.push(state.level);

    if (nearestPlayer) {
      const relativePos = new pc.Vec3().sub2(nearestPlayer.position, state.position);
      input.push(relativePos.x, relativePos.y, relativePos.z);
      input.push(distance);
    } else {
      input.push(0, 0, 0, 100);
      distance = 100;
    }

    const isLowHealth = healthRatio < 0.3 ? 1.0 : 0.0;
    const isPlayerFar = distance > 25 ? 1.0 : 0.0;
    const isPlayerClose = distance < 10 ? 1.0 : 0.0;
    const isPlayerVeryClose = distance < 5 ? 1.0 : 0.0;

    input.push(isLowHealth, isPlayerFar, isPlayerClose, isPlayerVeryClose);

    return input;
  }

  private argMax(array: number[]): number {
    let maxIndex = 0;
    let maxValue = array[0];
    for (let i = 1; i < array.length; i++) {
      if (array[i] > maxValue) {
        maxValue = array[i];
        maxIndex = i;
      }
    }
    return maxIndex;
  }

  private convertOutputToAction(index: number, state: NPCState, playerPositions: Map<string, pc.Vec3>): NPCAction {
    const nearestPlayer = this.findNearestPlayer(state.position, playerPositions);

    switch (index) {
      case 0:
        return this.getPatrolAction(state);
      case 1:
        if (nearestPlayer) {
          return { type: 'chase', target: nearestPlayer.position, speed: 3 };
        }
        return this.getPatrolAction(state);
      case 2:
        if (nearestPlayer) {
          return { type: 'attack', target: nearestPlayer.position };
        }
        return this.getPatrolAction(state);
      case 3:
        if (nearestPlayer) {
          const strafeDirection = new pc.Vec3(-(nearestPlayer.position.z - state.position.z), 0, nearestPlayer.position.x - state.position.x).normalize();
          return { type: 'strafe', direction: strafeDirection, speed: 2 };
        }
        return this.getPatrolAction(state);
      case 4:
        if (nearestPlayer) {
          const fleeDirection = new pc.Vec3().sub2(state.position, nearestPlayer.position).normalize();
          return { type: 'move', direction: fleeDirection, speed: 4 };
        }
        return this.getPatrolAction(state);
      default:
        return this.getPatrolAction(state);
    }
  }

  private findNearestPlayer(position: pc.Vec3, playerPositions: Map<string, pc.Vec3>): { id: string; position: pc.Vec3 } | null {
    let nearest: { id: string; position: pc.Vec3; distance: number } | null = null;

    for (const [id, playerPos] of playerPositions) {
      const distance = position.distance(playerPos);
      if (!nearest || distance < nearest.distance) {
        nearest = { id, position: playerPos, distance };
      }
    }

    return nearest ? { id: nearest.id, position: nearest.position } : null;
  }

  public getNPCState(npcId: string): NPCState | null {
    return this.npcStates.get(npcId) || null;
  }

  public getAllNPCStates(): NPCState[] {
    return Array.from(this.npcStates.values());
  }

  public removeNPC(npcId: string): void {
    this.npcStates.delete(npcId);
  }

  public isModelLoaded(): boolean {
    return this.modelLoaded;
  }

  public isUsingAI(): boolean {
    return this.useAI;
  }

  public setAIEnabled(enabled: boolean): void {
    this.useAI = enabled && this.modelLoaded;
  }

  public destroy(): void {
    this.npcStates.clear();
    this.session = null;
  }
}
