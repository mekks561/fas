import '@testing-library/jest-dom';

interface MockSkill {
  id: string;
  state: string;
  currentCooldown: number;
  level: number;
  maxLevel: number;
  cooldown: number;
}

vi.mock('wasmoon', () => {
  const learnedSkills: Record<string, MockSkill> = {};
  const activeCombo: { currentSequence: string[]; startTime: number; lastSkillTime: number } = {
    currentSequence: [],
    startTime: 0,
    lastSkillTime: 0,
  };

  const luaGlobals: Record<string, unknown> = {
    SkillSystem: {
      SkillState: {
        READY: 'ready',
        COOLDOWN: 'cooldown',
        ACTIVE: 'active',
        DISABLED: 'disabled',
        LOCKED: 'locked',
      },
      LearnedSkills: learnedSkills,
      ActiveCombo: activeCombo,

      createSkill: (skillId: string) => {
        if (typeof skillId !== 'string') return null;
        return {
          id: skillId,
          state: 'locked',
          currentCooldown: 0,
          level: 1,
          maxLevel: 10,
          cooldown: 0,
        };
      },

      learnSkill: (skillId: string, playerLevel: number, _learnedSkillIds: string[]) => {
        if (!skillId || typeof skillId !== 'string') return false;
        if (playerLevel < 0) return false;
        learnedSkills[skillId] = {
          id: skillId,
          state: 'ready',
          currentCooldown: 0,
          level: 1,
          maxLevel: 10,
          cooldown: 0.5,
        };
        return true;
      },

      upgradeSkill: (skillId: string) => {
        const skill = learnedSkills[skillId];
        if (skill && skill.level < skill.maxLevel) {
          skill.level = skill.level + 1;
          return [true, skill.level];
        }
        return [false, 0];
      },

      canCastSkill: (skillId: string, _resources: Record<string, number>) => {
        const skill = learnedSkills[skillId];
        if (!skill) return [false, 'skill_not_learned'];
        if (skill.state !== 'ready') return [false, 'skill_not_ready'];
        return [true, 'ready'];
      },

      castSkill: (
        skillId: string,
        _caster: unknown,
        _target: unknown,
        _resources: Record<string, number>,
      ) => {
        const skill = learnedSkills[skillId];
        if (!skill || skill.state !== 'ready') {
          return { success: false, error: 'skill_not_ready' };
        }
        skill.state = 'cooldown';
        skill.currentCooldown = skill.cooldown || 0;
        return {
          success: true,
          skillId: skillId,
          skillName: skillId,
          effects: [],
          remainingCooldown: skill.cooldown || 0,
          costPaid: 0,
        };
      },

      updateCooldowns: (deltaTime: number) => {
        const readySkills: string[] = [];
        for (const skillId in learnedSkills) {
          const skill = learnedSkills[skillId];
          if (skill.state === 'cooldown') {
            skill.currentCooldown = Math.max(0, skill.currentCooldown - deltaTime);
            if (skill.currentCooldown <= 0) {
              skill.state = 'ready';
              readySkills.push(skillId);
            }
          }
        }
        return readySkills;
      },

      getSkillStatus: (skillId: string) => {
        return learnedSkills[skillId] || null;
      },

      getAllSkillStatus: () => {
        return Object.values(learnedSkills);
      },

      resetCooldown: (skillId: string) => {
        const skill = learnedSkills[skillId];
        if (skill) {
          skill.currentCooldown = 0;
          skill.state = 'ready';
          return true;
        }
        return false;
      },

      startCombo: () => {
        activeCombo.currentSequence = [];
        activeCombo.startTime = Date.now();
        activeCombo.lastSkillTime = 0;
        return true;
      },

      addToCombo: (skillId: string) => {
        activeCombo.currentSequence.push(skillId);
        return [true, 'combo_in_progress'];
      },

      checkComboBonus: () => {
        return null;
      },
    },
  };

  const mockLuaState = {
    doString: vi.fn().mockReturnValue(true),
    global: {
      get: vi.fn().mockImplementation((name: string) => {
        const parts = name.split('.');
        let result: unknown = luaGlobals;
        for (const part of parts) {
          if (result !== undefined && typeof result === 'object') {
            result = (result as Record<string, unknown>)[part];
          } else {
            break;
          }
        }
        return result || (() => {});
      }),
      set: vi.fn(),
    },
    onError: vi.fn(),
    close: vi.fn(),
  };

  return {
    LuaState: vi.fn().mockImplementation(() => mockLuaState),
    factory: {
      create: vi.fn().mockResolvedValue(mockLuaState),
    },
  };
});

vi.mock('playcanvas', () => {
  class MockVec3 {
    x: number;
    y: number;
    z: number;

    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    clone = vi.fn().mockReturnThis();
    copy = vi.fn().mockReturnThis();
    add = vi.fn().mockReturnThis();
    sub = vi.fn().mockReturnThis();
    mul = vi.fn().mockReturnThis();
    div = vi.fn().mockReturnThis();
    dot = vi.fn().mockReturnValue(0);
    cross = vi.fn().mockReturnThis();
    length = vi.fn().mockReturnValue(0);
    normalize = vi.fn().mockReturnThis();
    distance = vi.fn().mockReturnValue(0);
  }

  class MockColor {
    r: number;
    g: number;
    b: number;
    a: number;

    constructor(r = 0, g = 0, b = 0, a = 1) {
      this.r = r;
      this.g = g;
      this.b = b;
      this.a = a;
    }

    clone = vi.fn().mockReturnThis();
    copy = vi.fn().mockReturnThis();
  }

  class MockQuat {
    clone = vi.fn().mockReturnThis();
    copy = vi.fn().mockReturnThis();
    setFromEuler = vi.fn().mockReturnThis();
  }

  class MockMat4 {
    clone = vi.fn().mockReturnThis();
    copy = vi.fn().mockReturnThis();
  }

  class MockEntity {
    addComponent = vi.fn().mockReturnThis();
    findByName = vi.fn();
    getPosition = vi.fn().mockReturnValue(new MockVec3());
    setPosition = vi.fn();
    lookAt = vi.fn();
    addChild = vi.fn();
    removeChild = vi.fn();
    destroy = vi.fn();
    enabled = true;
    name = '';
  }

  return {
    Vec3: MockVec3,
    Vec2: MockVec3,
    Color: MockColor,
    Quat: MockQuat,
    Mat4: MockMat4,
    Entity: MockEntity,
    Application: vi.fn(),
    Scene: vi.fn(),
    ScriptType: vi.fn(),
    createScript: vi.fn(),
  };
});

HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextType: string) => {
  if (contextType === 'webgl' || contextType === 'webgl2') {
    return {
      clear: vi.fn(),
      clearColor: vi.fn(),
      enable: vi.fn(),
      depthFunc: vi.fn(),
      blendFunc: vi.fn(),
      createShader: vi.fn(),
      createProgram: vi.fn(),
      getAttribLocation: vi.fn(),
      getUniformLocation: vi.fn(),
      useProgram: vi.fn(),
      uniform1i: vi.fn(),
      uniform1f: vi.fn(),
      uniform3f: vi.fn(),
      uniformMatrix4fv: vi.fn(),
    };
  }
  return null;
});

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  return setTimeout(() => callback(Date.now()), 16) as unknown as number;
});

window.cancelAnimationFrame = vi.fn((id: number) => {
  clearTimeout(id);
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') || args[0].includes('ReactDOM.render'))
  ) {
    return;
  }
  originalConsoleError(...args);
};

class MockAudioContext {
  createGain = vi.fn().mockReturnValue({
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  createBufferSource = vi.fn().mockReturnValue({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  });
  destination = {};
  currentTime = 0;
  resume = vi.fn();
  suspend = vi.fn();
  close = vi.fn();
}

(window as unknown as { AudioContext: typeof MockAudioContext }).AudioContext = MockAudioContext;
(window as unknown as { webkitAudioContext: typeof MockAudioContext }).webkitAudioContext =
  MockAudioContext;

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  headers: {
    get: (name: string) => {
      if (name.toLowerCase() === 'content-length') return '1024';
      return null;
    },
  },
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
  json: vi.fn().mockResolvedValue({ success: true }),
  text: vi.fn().mockResolvedValue('mock response'),
});
