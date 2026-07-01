const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '../public/assets');

// 辅助函数：如果目录不存在则创建
function createDirIfNotExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 辅助函数：写入 JSON 文件并打印日志
function writeJsonFile(filePath, content, fileName) {
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
  console.log(`Generated: ${fileName}`);
}

// ============================================================
// 1. 剧情文件生成 - 5个章节
// ============================================================
function generateStoryChapters() {
  console.log('\n--- Story Chapters ---');
  const storyDir = path.join(ASSETS_DIR, 'story');
  createDirIfNotExists(storyDir);

  const chapters = [
    {
      id: 'story-chapter-01',
      number: 1,
      title: '觉醒',
      titleEn: 'The Awakening',
      description: '外星入侵者突然出现在星际联邦边境星球附近。作为联邦精英飞行员，你接到紧急召唤，必须立即起飞迎敌，击退入侵的侦察部队，保卫联邦边境安全。',
      background: '银河历2387年，星际联邦边境哨站截获异常能量信号。数小时后，未知外星种族的侦察舰队跃迁至边境星球轨道，对联邦哨站发起突袭。联邦指挥部紧急召回所有现役飞行员。',
      dialogueSequence: [
        { speaker: 'commander', text: '飞行员，紧急情况！外星入侵者出现在边境，立即起飞迎敌！', emotion: 'urgent' },
        { speaker: 'pilot', text: '收到，指挥官。我马上起飞。', emotion: 'determined' },
        { speaker: 'commander', text: '先摧毁他们的侦察部队，为我们争取时间。', emotion: 'serious' },
        { speaker: 'pilot', text: '明白，我会让他们见识联邦飞行员的实力。', emotion: 'confident' }
      ],
      objectives: [
        '摧毁所有敌方侦察机',
        '保护边境哨站不被摧毁',
        '存活至援军到达'
      ],
      rewards: {
        experience: 500,
        credits: 2000,
        unlocks: ['weapon-laser', 'mission-02'],
        achievement: 'achievement-01'
      }
    },
    {
      id: 'story-chapter-02',
      number: 2,
      title: '反击',
      titleEn: 'Counterstrike',
      description: '在成功击退边境入侵后，联邦决定主动出击。你的任务是深入敌方区域，摧毁外星人的补给线，切断他们的后勤支援。',
      background: '边境保卫战胜利后，联邦指挥部分析了缴获的敌方数据，发现外星人的补给线是他们的弱点。一次精心策划的反击行动就此展开。',
      dialogueSequence: [
        { speaker: 'commander', text: '飞行员，根据缴获的情报，我们发现了敌方的补给线。', emotion: 'calm' },
        { speaker: 'tactical_officer', text: '补给线由三艘运输船和护卫舰队保护，建议分批次攻击。', emotion: 'analytical' },
        { speaker: 'pilot', text: '我可以在护卫舰队反应过来之前摧毁运输船。', emotion: 'confident' },
        { speaker: 'commander', text: '小心行事，这次任务比上次危险得多。', emotion: 'concerned' },
        { speaker: 'pilot', text: '明白，我不会让您失望的。', emotion: 'determined' }
      ],
      objectives: [
        '摧毁3艘敌方运输船',
        '击败护卫舰队',
        '不被敌方主力舰队发现'
      ],
      rewards: {
        experience: 1200,
        credits: 5000,
        unlocks: ['ship-bomber', 'mission-06'],
        achievement: 'achievement-02'
      }
    },
    {
      id: 'story-chapter-03',
      number: 3,
      title: '深入敌后',
      titleEn: 'Behind Enemy Lines',
      description: '联邦情报部门发现敌方指挥系统位于敌方腹地。你必须驾驶隐形飞船潜入敌方区域，收集情报并破坏敌方指挥系统。',
      background: '通过破解的敌方通讯，情报部门定位了敌方指挥舰的位置。一次高风险的潜行任务即将开始，成功与否将决定整个战争的走向。',
      dialogueSequence: [
        { speaker: 'intelligence_officer', text: '我们锁定了敌方指挥舰的位置，但它在敌方腹地。', emotion: 'serious' },
        { speaker: 'commander', text: '这次任务需要潜行，不能被发现的。', emotion: 'serious' },
        { speaker: 'pilot', text: '隐形飞船已经准备好，我可以做到。', emotion: 'confident' },
        { speaker: 'intelligence_officer', text: '收集指挥系统的数据后立即撤离，不要恋战。', emotion: 'cautious' },
        { speaker: 'pilot', text: '收到，我会像幽灵一样来去无踪。', emotion: 'determined' }
      ],
      objectives: [
        '潜入敌方区域不被发现',
        '收集敌方指挥系统情报',
        '摧毁敌方指挥舰',
        '安全撤离'
      ],
      rewards: {
        experience: 2500,
        credits: 10000,
        unlocks: ['ship-stealth', 'weapon-sniper', 'mission-10'],
        achievement: 'achievement-03'
      }
    },
    {
      id: 'story-chapter-04',
      number: 4,
      title: '大举进攻',
      titleEn: 'The Great Offensive',
      description: '掌握了敌方情报后，联邦集结全部舰队发动总攻。你的任务是突破敌方防线，为联邦舰队开辟通往敌方母舰的道路。',
      background: '情报显示外星人的母舰由强大的护卫舰队保护。联邦集结了所有可用的战舰，发动了史上最大规模的进攻行动。你是这次行动的先锋。',
      dialogueSequence: [
        { speaker: 'admiral', text: '飞行员，今天是决定性的时刻。联邦的全部希望寄托在你身上。', emotion: 'solemn' },
        { speaker: 'pilot', text: '将军，我已经准备好了。', emotion: 'determined' },
        { speaker: 'admiral', text: '突破敌方护卫舰队，为我们打开通往母舰的道路。', emotion: 'commanding' },
        { speaker: 'wingman', text: '我会掩护你的侧翼，祝我们好运。', emotion: 'nervous' },
        { speaker: 'pilot', text: '不需要运气，让我们出发吧！', emotion: 'fearless' }
      ],
      objectives: [
        '摧毁敌方前锋舰队',
        '击败重型护卫舰',
        '保护联邦旗舰',
        '为进攻舰队开辟道路'
      ],
      rewards: {
        experience: 5000,
        credits: 25000,
        unlocks: ['ship-dreadnought', 'weapon-nuke', 'mission-17'],
        achievement: 'achievement-04'
      }
    },
    {
      id: 'story-chapter-05',
      number: 5,
      title: '最终决战',
      titleEn: 'Final Stand',
      description: '联邦舰队已抵达敌方母舰前。现在，你必须直面外星首领 Overlord，在一场决定银河系命运的最终决战中击败他。',
      background: '经过漫长的战斗，联邦舰队终于突破了所有防线，来到了外星母舰面前。Overlord——外星种族的至高领袖——亲自驾驶着他的旗舰迎战。这场战斗的胜者，将决定整个银河系的命运。',
      dialogueSequence: [
        { speaker: 'admiral', text: '飞行员，Overlord 的母舰就在前方。这是你的时刻。', emotion: 'solemn' },
        { speaker: 'overlord', text: '渺小的人类，你以为你能挑战我吗？', emotion: 'arrogant' },
        { speaker: 'pilot', text: '为了银河系的和平，我必须击败你！', emotion: 'determined' },
        { speaker: 'overlord', text: '你的联邦将在我的铁蹄下灰飞烟灭！', emotion: 'menacing' },
        { speaker: 'commander', text: '全舰队为飞行员提供火力支援，这是我们的最后机会！', emotion: 'urgent' },
        { speaker: 'pilot', text: '为了联邦，为了银河系，冲啊！', emotion: 'fearless' }
      ],
      objectives: [
        '击败 Overlord 的护卫舰队',
        '摧毁 Overlord 旗舰的护盾发生器',
        '击败 Overlord',
        '存活到最终时刻'
      ],
      rewards: {
        experience: 10000,
        credits: 100000,
        unlocks: ['ship-corvette', 'weapon-blackhole', 'skill-rebirth'],
        achievement: 'achievement-05'
      }
    }
  ];

  chapters.forEach(chapter => {
    const fileName = `story-chapter-${String(chapter.number).padStart(2, '0')}.json`;
    const filePath = path.join(storyDir, fileName);
    writeJsonFile(filePath, chapter, fileName);
  });

  console.log(`Total story chapters generated: ${chapters.length}`);
  return chapters;
}

// ============================================================
// 2. 任务系统生成 - 20个任务
// ============================================================
function generateMissions() {
  console.log('\n--- Missions ---');
  const missionsDir = path.join(ASSETS_DIR, 'missions');
  createDirIfNotExists(missionsDir);

  const missions = [
    {
      id: 'mission-01',
      name: '边境侦察',
      description: '摧毁出现在边境的敌方侦察机部队，保护联邦哨站。',
      type: 'main',
      category: 'destroy',
      objectives: [
        { type: 'destroy', target: 'enemy-scout', count: 4, current: 0 },
        { type: 'survive', duration: 60, current: 0 }
      ],
      rewards: { experience: 200, credits: 800, items: [] },
      prerequisites: [],
      chapter: 'story-chapter-01'
    },
    {
      id: 'mission-02',
      name: '护航行动',
      description: '护送联邦运输船安全抵达目的地，途中将遭遇敌方拦截。',
      type: 'main',
      category: 'escort',
      objectives: [
        { type: 'escort', target: 'transport-ship', healthThreshold: 50 },
        { type: 'destroy', target: 'enemy-fighter', count: 6, current: 0 }
      ],
      rewards: { experience: 350, credits: 1500, items: ['powerup-shield'] },
      prerequisites: ['mission-01'],
      chapter: 'story-chapter-01'
    },
    {
      id: 'mission-03',
      name: '能量晶体收集',
      description: '在小行星带中收集稀有的能量晶体，用于联邦的武器研发。',
      type: 'side',
      category: 'collect',
      objectives: [
        { type: 'collect', target: 'energy-crystal', count: 10, current: 0 }
      ],
      rewards: { experience: 250, credits: 1200, items: ['powerup-energy'] },
      prerequisites: ['mission-01'],
      chapter: null
    },
    {
      id: 'mission-04',
      name: '生存考验',
      description: '在敌方增援不断涌来的情况下存活3分钟。',
      type: 'side',
      category: 'survival',
      objectives: [
        { type: 'survive', duration: 180, current: 0 }
      ],
      rewards: { experience: 400, credits: 2000, items: ['powerup-health'] },
      prerequisites: ['mission-01'],
      chapter: null
    },
    {
      id: 'mission-05',
      name: '日常：歼灭任务',
      description: '每日任务：摧毁10个敌方单位。',
      type: 'daily',
      category: 'destroy',
      objectives: [
        { type: 'destroy', target: 'any', count: 10, current: 0 }
      ],
      rewards: { experience: 100, credits: 500, items: [] },
      prerequisites: [],
      chapter: null,
      resetDaily: true
    },
    {
      id: 'mission-06',
      name: '补给线突袭',
      description: '深入敌方区域，摧毁3艘敌方运输船，切断敌方补给线。',
      type: 'main',
      category: 'destroy',
      objectives: [
        { type: 'destroy', target: 'enemy-transport', count: 3, current: 0 },
        { type: 'destroy', target: 'enemy-corvette', count: 2, current: 0 }
      ],
      rewards: { experience: 800, credits: 3000, items: ['weapon-missile'] },
      prerequisites: ['mission-02'],
      chapter: 'story-chapter-02'
    },
    {
      id: 'mission-07',
      name: 'Boss战：哨兵',
      description: '击败敌方护卫舰队的指挥官——Sentinel。',
      type: 'main',
      category: 'boss',
      objectives: [
        { type: 'boss', target: 'boss-sentinel', defeat: false }
      ],
      rewards: { experience: 1500, credits: 6000, items: ['ship-cruiser'] },
      prerequisites: ['mission-06'],
      chapter: 'story-chapter-02'
    },
    {
      id: 'mission-08',
      name: 'VIP护送',
      description: '护送联邦高级官员安全抵达前线指挥部。',
      type: 'side',
      category: 'escort',
      objectives: [
        { type: 'escort', target: 'vip-ship', healthThreshold: 80 },
        { type: 'destroy', target: 'enemy-assassin', count: 3, current: 0 }
      ],
      rewards: { experience: 500, credits: 2500, items: ['powerup-defense'] },
      prerequisites: ['mission-02'],
      chapter: null
    },
    {
      id: 'mission-09',
      name: '潜入行动',
      description: '驾驶隐形飞船潜入敌方区域，不被发现地抵达目标点。',
      type: 'main',
      category: 'stealth',
      objectives: [
        { type: 'reach', target: 'enemy-zone', undetected: true },
        { type: 'collect', target: 'intel', count: 3, current: 0 }
      ],
      rewards: { experience: 1000, credits: 4000, items: ['ship-stealth'] },
      prerequisites: ['mission-07'],
      chapter: 'story-chapter-03'
    },
    {
      id: 'mission-10',
      name: '情报收集',
      description: '在敌方区域内收集关于敌方指挥系统的关键情报。',
      type: 'main',
      category: 'collect',
      objectives: [
        { type: 'collect', target: 'intel-data', count: 5, current: 0 },
        { type: 'survive', duration: 120, current: 0 }
      ],
      rewards: { experience: 1200, credits: 5000, items: ['weapon-sniper'] },
      prerequisites: ['mission-09'],
      chapter: 'story-chapter-03'
    },
    {
      id: 'mission-11',
      name: '日常：信用点收集',
      description: '每日任务：通过战斗收集1000信用点。',
      type: 'daily',
      category: 'collect',
      objectives: [
        { type: 'collect', target: 'credits', count: 1000, current: 0 }
      ],
      rewards: { experience: 150, credits: 600, items: [] },
      prerequisites: [],
      chapter: null,
      resetDaily: true
    },
    {
      id: 'mission-12',
      name: '指挥舰突袭',
      description: '摧毁敌方指挥舰，瓦解敌方的指挥系统。',
      type: 'main',
      category: 'destroy',
      objectives: [
        { type: 'destroy', target: 'enemy-destroyer', count: 2, current: 0 },
        { type: 'boss', target: 'command-ship', defeat: false }
      ],
      rewards: { experience: 2000, credits: 8000, items: ['skill-stealth'] },
      prerequisites: ['mission-10'],
      chapter: 'story-chapter-03'
    },
    {
      id: 'mission-13',
      name: '生存挑战',
      description: '在密集的敌方火力下存活5分钟。',
      type: 'side',
      category: 'survival',
      objectives: [
        { type: 'survive', duration: 300, current: 0 },
        { type: 'destroy', target: 'any', count: 20, current: 0 }
      ],
      rewards: { experience: 800, credits: 4000, items: ['powerup-invincible'] },
      prerequisites: ['mission-07'],
      chapter: null
    },
    {
      id: 'mission-14',
      name: '舰队先锋',
      description: '作为联邦舰队的先锋，突破敌方前锋防线。',
      type: 'main',
      category: 'destroy',
      objectives: [
        { type: 'destroy', target: 'enemy-fighter', count: 15, current: 0 },
        { type: 'destroy', target: 'enemy-bomber', count: 5, current: 0 }
      ],
      rewards: { experience: 2500, credits: 10000, items: ['ship-dreadnought'] },
      prerequisites: ['mission-12'],
      chapter: 'story-chapter-04'
    },
    {
      id: 'mission-15',
      name: '日常：任务达人',
      description: '每日任务：完成3个任意任务。',
      type: 'daily',
      category: 'collect',
      objectives: [
        { type: 'complete', target: 'any-mission', count: 3, current: 0 }
      ],
      rewards: { experience: 200, credits: 1000, items: [] },
      prerequisites: [],
      chapter: null,
      resetDaily: true
    },
    {
      id: 'mission-16',
      name: '稀有材料',
      description: '收集稀有的合金材料，用于研发新型武器。',
      type: 'side',
      category: 'collect',
      objectives: [
        { type: 'collect', target: 'rare-alloy', count: 8, current: 0 },
        { type: 'destroy', target: 'enemy-tank', count: 4, current: 0 }
      ],
      rewards: { experience: 1000, credits: 5000, items: ['weapon-plasma'] },
      prerequisites: ['mission-08'],
      chapter: null
    },
    {
      id: 'mission-17',
      name: '护卫舰队歼灭',
      description: '击败保护 Overlord 母舰的护卫舰队。',
      type: 'main',
      category: 'destroy',
      objectives: [
        { type: 'destroy', target: 'enemy-destroyer', count: 4, current: 0 },
        { type: 'destroy', target: 'enemy-corvette', count: 6, current: 0 },
        { type: 'boss', target: 'boss-sentinel', defeat: false }
      ],
      rewards: { experience: 4000, credits: 20000, items: ['weapon-nuke'] },
      prerequisites: ['mission-14'],
      chapter: 'story-chapter-04'
    },
    {
      id: 'mission-18',
      name: '日常：歼灭专家',
      description: '每日任务：摧毁50个敌方单位。',
      type: 'daily',
      category: 'destroy',
      objectives: [
        { type: 'destroy', target: 'any', count: 50, current: 0 }
      ],
      rewards: { experience: 300, credits: 1500, items: [] },
      prerequisites: [],
      chapter: null,
      resetDaily: true
    },
    {
      id: 'mission-19',
      name: '极限生存',
      description: '在 Boss 级敌人的攻击下存活10分钟。',
      type: 'side',
      category: 'survival',
      objectives: [
        { type: 'survive', duration: 600, current: 0 },
        { type: 'boss', target: 'boss-overlord', survive: true }
      ],
      rewards: { experience: 3000, credits: 15000, items: ['skill-rebirth'] },
      prerequisites: ['mission-17'],
      chapter: null
    },
    {
      id: 'mission-20',
      name: 'Boss战：霸主',
      description: '最终决战：击败外星首领 Overlord，拯救银河系。',
      type: 'main',
      category: 'boss',
      objectives: [
        { type: 'destroy', target: 'shield-generator', count: 4, current: 0 },
        { type: 'boss', target: 'boss-overlord', defeat: false }
      ],
      rewards: { experience: 10000, credits: 100000, items: ['weapon-blackhole', 'ship-corvette'] },
      prerequisites: ['mission-17'],
      chapter: 'story-chapter-05'
    }
  ];

  missions.forEach((mission, index) => {
    const fileName = `mission-${String(index + 1).padStart(2, '0')}.json`;
    const filePath = path.join(missionsDir, fileName);
    writeJsonFile(filePath, mission, fileName);
  });

  console.log(`Total missions generated: ${missions.length}`);
  return missions;
}

// ============================================================
// 3. 对话系统生成 - 10个对话
// ============================================================
function generateDialogues() {
  console.log('\n--- Dialogues ---');
  const dialoguesDir = path.join(ASSETS_DIR, 'dialogues');
  createDirIfNotExists(dialoguesDir);

  const dialogues = [
    {
      id: 'dialogue-01',
      name: '紧急召集',
      participants: ['commander', 'pilot'],
      trigger: { type: 'story', chapter: 'story-chapter-01', stage: 'start' },
      lines: [
        { speaker: 'commander', text: '飞行员，紧急情况！外星入侵者出现在边境。', emotion: 'urgent', portrait: 'commander-worried' },
        { speaker: 'pilot', text: '发生了什么？', emotion: 'surprised', portrait: 'pilot-neutral' },
        { speaker: 'commander', text: '未知种族的舰队突袭了我们的边境哨站，我们需要你立即起飞。', emotion: 'serious', portrait: 'commander-serious' },
        { speaker: 'pilot', text: '我马上出发！', emotion: 'determined', portrait: 'pilot-determined' }
      ]
    },
    {
      id: 'dialogue-02',
      name: '战术简报',
      participants: ['commander', 'tactical_officer', 'pilot'],
      trigger: { type: 'story', chapter: 'story-chapter-02', stage: 'start' },
      lines: [
        { speaker: 'commander', text: '我们发现了敌方的补给线，是时候反击了。', emotion: 'calm', portrait: 'commander-neutral' },
        { speaker: 'tactical_officer', text: '补给线由运输船和护卫舰队保护，建议分批攻击。', emotion: 'analytical', portrait: 'tactical-focused' },
        { speaker: 'pilot', text: '我可以先解决护卫舰队。', emotion: 'confident', portrait: 'pilot-confident' },
        { speaker: 'tactical_officer', text: '不，先打运输船，趁护卫舰队混乱时撤离。', emotion: 'cautious', portrait: 'tactical-worried' },
        { speaker: 'pilot', text: '明白了，速战速决。', emotion: 'serious', portrait: 'pilot-serious' }
      ]
    },
    {
      id: 'dialogue-03',
      name: '情报汇报',
      participants: ['intelligence_officer', 'pilot'],
      trigger: { type: 'story', chapter: 'story-chapter-03', stage: 'start' },
      lines: [
        { speaker: 'intelligence_officer', text: '我们破解了敌方通讯，定位了指挥舰。', emotion: 'excited', portrait: 'intel-excited' },
        { speaker: 'pilot', text: '在哪里？', emotion: 'curious', portrait: 'pilot-neutral' },
        { speaker: 'intelligence_officer', text: '在敌方腹地，需要潜行进入。', emotion: 'serious', portrait: 'intel-serious' },
        { speaker: 'pilot', text: '隐形飞船能帮我做到。', emotion: 'confident', portrait: 'pilot-confident' },
        { speaker: 'intelligence_officer', text: '记住，不要被发现，情报比战斗更重要。', emotion: 'cautious', portrait: 'intel-cautious' }
      ]
    },
    {
      id: 'dialogue-04',
      name: '战友对话',
      participants: ['pilot', 'wingman'],
      trigger: { type: 'mission', mission: 'mission-02', stage: 'start' },
      lines: [
        { speaker: 'wingman', text: '老伙计，又要一起执行任务了。', emotion: 'happy', portrait: 'wingman-happy' },
        { speaker: 'pilot', text: '是啊，这次是护送任务，要小心。', emotion: 'calm', portrait: 'pilot-neutral' },
        { speaker: 'wingman', text: '放心，有我掩护你的侧翼。', emotion: 'confident', portrait: 'wingman-confident' },
        { speaker: 'pilot', text: '那就拜托你了。', emotion: 'grateful', portrait: 'pilot-happy' }
      ]
    },
    {
      id: 'dialogue-05',
      name: 'Boss战前',
      participants: ['commander', 'pilot'],
      trigger: { type: 'mission', mission: 'mission-07', stage: 'start' },
      lines: [
        { speaker: 'commander', text: '飞行员，前方就是 Sentinel 的旗舰。', emotion: 'serious', portrait: 'commander-serious' },
        { speaker: 'pilot', text: '我看到了，它比我想象的更大。', emotion: 'nervous', portrait: 'pilot-nervous' },
        { speaker: 'commander', text: '不要被它的外表吓到，找到它的弱点。', emotion: 'encouraging', portrait: 'commander-encouraging' },
        { speaker: 'pilot', text: '明白，我会全力以赴的！', emotion: 'determined', portrait: 'pilot-determined' }
      ]
    },
    {
      id: 'dialogue-06',
      name: '胜利庆祝',
      participants: ['commander', 'pilot', 'wingman'],
      trigger: { type: 'mission', mission: 'mission-07', stage: 'complete' },
      lines: [
        { speaker: 'wingman', text: '太棒了！我们做到了！', emotion: 'excited', portrait: 'wingman-excited' },
        { speaker: 'pilot', text: '这只是开始，更大的挑战还在后面。', emotion: 'calm', portrait: 'pilot-neutral' },
        { speaker: 'commander', text: '干得好，飞行员。联邦为你骄傲。', emotion: 'proud', portrait: 'commander-happy' },
        { speaker: 'pilot', text: '谢谢，指挥官。这只是职责所在。', emotion: 'humble', portrait: 'pilot-humble' }
      ]
    },
    {
      id: 'dialogue-07',
      name: '失败安慰',
      participants: ['commander', 'pilot'],
      trigger: { type: 'mission', mission: 'any', stage: 'failed' },
      lines: [
        { speaker: 'commander', text: '飞行员，你还好吗？', emotion: 'concerned', portrait: 'commander-worried' },
        { speaker: 'pilot', text: '我没事，只是...任务失败了。', emotion: 'sad', portrait: 'pilot-sad' },
        { speaker: 'commander', text: '失败是成功之母，从中学习，下次会更好。', emotion: 'encouraging', portrait: 'commander-encouraging' },
        { speaker: 'pilot', text: '您说得对，我不会放弃的。', emotion: 'determined', portrait: 'pilot-determined' }
      ]
    },
    {
      id: 'dialogue-08',
      name: '任务完成',
      participants: ['commander', 'pilot'],
      trigger: { type: 'mission', mission: 'any', stage: 'complete' },
      lines: [
        { speaker: 'pilot', text: '指挥官，任务完成。', emotion: 'satisfied', portrait: 'pilot-satisfied' },
        { speaker: 'commander', text: '出色的表现，飞行员。奖励已发送到你的账户。', emotion: 'pleased', portrait: 'commander-happy' },
        { speaker: 'pilot', text: '谢谢！随时准备下一个任务。', emotion: 'eager', portrait: 'pilot-eager' }
      ]
    },
    {
      id: 'dialogue-09',
      name: '最终决战前',
      participants: ['admiral', 'pilot'],
      trigger: { type: 'story', chapter: 'story-chapter-05', stage: 'start' },
      lines: [
        { speaker: 'admiral', text: '飞行员，今天将载入史册。', emotion: 'solemn', portrait: 'admiral-solemn' },
        { speaker: 'pilot', text: '将军，我会尽我所能。', emotion: 'serious', portrait: 'pilot-serious' },
        { speaker: 'admiral', text: 'Overlord 是强大的敌人，但我相信你能做到。', emotion: 'confident', portrait: 'admiral-confident' },
        { speaker: 'pilot', text: '为了联邦，为了银河系，我不会失败。', emotion: 'determined', portrait: 'pilot-determined' },
        { speaker: 'admiral', text: '去吧，英雄。愿星辰与你同在。', emotion: 'inspiring', portrait: 'admiral-inspiring' }
      ]
    },
    {
      id: 'dialogue-10',
      name: '结局对话',
      participants: ['admiral', 'pilot', 'commander', 'wingman'],
      trigger: { type: 'story', chapter: 'story-chapter-05', stage: 'complete' },
      lines: [
        { speaker: 'wingman', text: '你做到了！Overlord 被击败了！', emotion: 'ecstatic', portrait: 'wingman-excited' },
        { speaker: 'commander', text: '银河系得救了，全靠你。', emotion: 'grateful', portrait: 'commander-grateful' },
        { speaker: 'pilot', text: '这不是我一个人的功劳，是大家共同的胜利。', emotion: 'humble', portrait: 'pilot-humble' },
        { speaker: 'admiral', text: '飞行员，你将被授予联邦最高荣誉。', emotion: 'proud', portrait: 'admiral-proud' },
        { speaker: 'pilot', text: '谢谢，将军。但和平到来才是最好的奖励。', emotion: 'peaceful', portrait: 'pilot-peaceful' },
        { speaker: 'admiral', text: '说得好。愿你未来的飞行永远平安。', emotion: 'warm', portrait: 'admiral-warm' }
      ]
    }
  ];

  dialogues.forEach((dialogue, index) => {
    const fileName = `dialogue-${String(index + 1).padStart(2, '0')}.json`;
    const filePath = path.join(dialoguesDir, fileName);
    writeJsonFile(filePath, dialogue, fileName);
  });

  console.log(`Total dialogues generated: ${dialogues.length}`);
  return dialogues;
}

// ============================================================
// 4. 成就配置生成 - 15个成就
// ============================================================
function generateAchievements() {
  console.log('\n--- Achievements ---');
  const achievementsDir = path.join(ASSETS_DIR, 'achievements');
  createDirIfNotExists(achievementsDir);

  const achievements = [
    {
      id: 'achievement-01',
      name: '首次胜利',
      description: '完成第一章剧情"觉醒"。',
      category: 'story',
      condition: { type: 'story_complete', target: 'story-chapter-01' },
      rewards: { experience: 100, credits: 500, icon: 'icon-achieve' },
      icon: 'icon-achieve',
      rarity: 'common'
    },
    {
      id: 'achievement-02',
      name: '反击先锋',
      description: '完成第二章剧情"反击"。',
      category: 'story',
      condition: { type: 'story_complete', target: 'story-chapter-02' },
      rewards: { experience: 300, credits: 1000, icon: 'icon-achieve' },
      icon: 'icon-achieve',
      rarity: 'common'
    },
    {
      id: 'achievement-03',
      name: '幽灵特工',
      description: '完成第三章剧情"深入敌后"。',
      category: 'story',
      condition: { type: 'story_complete', target: 'story-chapter-03' },
      rewards: { experience: 500, credits: 2000, icon: 'icon-achieve' },
      icon: 'icon-achieve',
      rarity: 'rare'
    },
    {
      id: 'achievement-04',
      name: '进攻英雄',
      description: '完成第四章剧情"大举进攻"。',
      category: 'story',
      condition: { type: 'story_complete', target: 'story-chapter-04' },
      rewards: { experience: 1000, credits: 5000, icon: 'icon-achieve' },
      icon: 'icon-achieve',
      rarity: 'rare'
    },
    {
      id: 'achievement-05',
      name: '银河救世主',
      description: '完成第五章剧情"最终决战"，击败 Overlord。',
      category: 'story',
      condition: { type: 'story_complete', target: 'story-chapter-05' },
      rewards: { experience: 5000, credits: 20000, icon: 'icon-star' },
      icon: 'icon-star',
      rarity: 'legendary'
    },
    {
      id: 'achievement-06',
      name: '战场老兵',
      description: '累计完成5个任务。',
      category: 'mission',
      condition: { type: 'mission_count', count: 5 },
      rewards: { experience: 200, credits: 1000, icon: 'icon-achieve' },
      icon: 'icon-achieve',
      rarity: 'common'
    },
    {
      id: 'achievement-07',
      name: '任务大师',
      description: '累计完成20个任务。',
      category: 'mission',
      condition: { type: 'mission_count', count: 20 },
      rewards: { experience: 1000, credits: 5000, icon: 'icon-achieve' },
      icon: 'icon-achieve',
      rarity: 'rare'
    },
    {
      id: 'achievement-08',
      name: '屠夫',
      description: '累计摧毁100个敌方单位。',
      category: 'combat',
      condition: { type: 'kill_count', count: 100 },
      rewards: { experience: 300, credits: 1500, icon: 'icon-crosshair' },
      icon: 'icon-crosshair',
      rarity: 'common'
    },
    {
      id: 'achievement-09',
      name: '歼灭者',
      description: '累计摧毁1000个敌方单位。',
      category: 'combat',
      condition: { type: 'kill_count', count: 1000 },
      rewards: { experience: 2000, credits: 10000, icon: 'icon-crosshair' },
      icon: 'icon-crosshair',
      rarity: 'epic'
    },
    {
      id: 'achievement-10',
      name: 'Boss杀手',
      description: '击败第一个Boss——Sentinel。',
      category: 'combat',
      condition: { type: 'boss_defeat', target: 'boss-sentinel' },
      rewards: { experience: 500, credits: 3000, icon: 'icon-star' },
      icon: 'icon-star',
      rarity: 'rare'
    },
    {
      id: 'achievement-11',
      name: '终结者',
      description: '击败最终Boss——Overlord。',
      category: 'combat',
      condition: { type: 'boss_defeat', target: 'boss-overlord' },
      rewards: { experience: 5000, credits: 20000, icon: 'icon-star' },
      icon: 'icon-star',
      rarity: 'legendary'
    },
    {
      id: 'achievement-12',
      name: '不死之身',
      description: '在不受任何伤害的情况下完成一个任务。',
      category: 'skill',
      condition: { type: 'no_damage_mission', count: 1 },
      rewards: { experience: 800, credits: 4000, icon: 'icon-shield' },
      icon: 'icon-shield',
      rarity: 'epic'
    },
    {
      id: 'achievement-13',
      name: '速度狂魔',
      description: '在5分钟内完成一个任务。',
      category: 'skill',
      condition: { type: 'speed_run', timeLimit: 300 },
      rewards: { experience: 600, credits: 3000, icon: 'icon-speed' },
      icon: 'icon-speed',
      rarity: 'rare'
    },
    {
      id: 'achievement-14',
      name: '生存专家',
      description: '在生存模式中存活10分钟。',
      category: 'skill',
      condition: { type: 'survival_time', duration: 600 },
      rewards: { experience: 1000, credits: 5000, icon: 'icon-clock' },
      icon: 'icon-clock',
      rarity: 'epic'
    },
    {
      id: 'achievement-15',
      name: '传奇飞行员',
      description: '解锁所有其他成就。',
      category: 'special',
      condition: { type: 'all_achievements' },
      rewards: { experience: 10000, credits: 50000, icon: 'icon-star', title: '银河传奇' },
      icon: 'icon-star',
      rarity: 'legendary'
    }
  ];

  achievements.forEach((achievement, index) => {
    const fileName = `achievement-${String(index + 1).padStart(2, '0')}.json`;
    const filePath = path.join(achievementsDir, fileName);
    writeJsonFile(filePath, achievement, fileName);
  });

  console.log(`Total achievements generated: ${achievements.length}`);
  return achievements;
}

// ============================================================
// 5. 商店物品生成 - 20个物品
// ============================================================
function generateShopItems() {
  console.log('\n--- Shop Items ---');
  const shopDir = path.join(ASSETS_DIR, 'shop');
  createDirIfNotExists(shopDir);

  const shopItems = [
    {
      id: 'shop-item-01',
      name: '重型巡洋舰',
      description: '火力强大的重型战舰，适合正面战斗。',
      type: 'ship',
      subtype: 'cruiser',
      price: 15000,
      currency: 'credits',
      attributes: { health: 200, shield: 100, speed: 50, damage: 30, weaponSlots: 4 },
      icon: 'icon-character',
      rarity: 'rare',
      level: 5
    },
    {
      id: 'shop-item-02',
      name: '隐形战机',
      description: '可短暂隐形的轻型战机，适合潜行任务。',
      type: 'ship',
      subtype: 'stealth',
      price: 25000,
      currency: 'credits',
      attributes: { health: 80, shield: 50, speed: 90, damage: 25, weaponSlots: 3, stealth: true },
      icon: 'icon-character',
      rarity: 'epic',
      level: 10
    },
    {
      id: 'shop-item-03',
      name: '无畏舰',
      description: '联邦最强大的战舰，拥有毁灭性的火力。',
      type: 'ship',
      subtype: 'dreadnought',
      price: 80000,
      currency: 'credits',
      attributes: { health: 400, shield: 200, speed: 30, damage: 50, weaponSlots: 6 },
      icon: 'icon-character',
      rarity: 'legendary',
      level: 20
    },
    {
      id: 'shop-item-04',
      name: '等离子炮',
      description: '高伤害的能量武器，可穿透护盾。',
      type: 'weapon',
      subtype: 'plasma',
      price: 5000,
      currency: 'credits',
      attributes: { damage: 35, fireRate: 2, energyCost: 15, shieldPiercing: true },
      icon: 'icon-gun',
      rarity: 'rare',
      level: 5
    },
    {
      id: 'shop-item-05',
      name: '狙击激光',
      description: '超远射程的精确激光武器。',
      type: 'weapon',
      subtype: 'sniper',
      price: 8000,
      currency: 'credits',
      attributes: { damage: 80, fireRate: 0.5, range: 1000, accuracy: 95 },
      icon: 'icon-gun',
      rarity: 'epic',
      level: 10
    },
    {
      id: 'shop-item-06',
      name: '核弹发射器',
      description: '可发射核弹的强大武器，造成范围伤害。',
      type: 'weapon',
      subtype: 'nuke',
      price: 30000,
      currency: 'credits',
      attributes: { damage: 500, fireRate: 0.2, splashRadius: 200, energyCost: 100 },
      icon: 'icon-bomb',
      rarity: 'legendary',
      level: 20
    },
    {
      id: 'shop-item-07',
      name: '黑洞发生器',
      description: '可制造黑洞吸引并摧毁敌人的终极武器。',
      type: 'weapon',
      subtype: 'blackhole',
      price: 100000,
      currency: 'credits',
      attributes: { damage: 1000, fireRate: 0.1, pullRadius: 500, duration: 5 },
      icon: 'icon-bomb',
      rarity: 'legendary',
      level: 30
    },
    {
      id: 'shop-item-08',
      name: '导弹发射器',
      description: '追踪导弹武器，自动锁定目标。',
      type: 'weapon',
      subtype: 'missile',
      price: 4000,
      currency: 'credits',
      attributes: { damage: 50, fireRate: 1, homing: true, ammo: 20 },
      icon: 'icon-missile',
      rarity: 'common',
      level: 3
    },
    {
      id: 'shop-item-09',
      name: '生命包（5个）',
      description: '恢复50点生命值的消耗品，包含5个。',
      type: 'consumable',
      subtype: 'health',
      price: 1000,
      currency: 'credits',
      attributes: { healAmount: 50, count: 5 },
      icon: 'icon-heart',
      rarity: 'common',
      level: 1
    },
    {
      id: 'shop-item-10',
      name: '护盾电池（5个）',
      description: '恢复50点护盾值的消耗品，包含5个。',
      type: 'consumable',
      subtype: 'shield',
      price: 1200,
      currency: 'credits',
      attributes: { shieldAmount: 50, count: 5 },
      icon: 'icon-shield',
      rarity: 'common',
      level: 1
    },
    {
      id: 'shop-item-11',
      name: '能量电池（5个）',
      description: '恢复100点能量值的消耗品，包含5个。',
      type: 'consumable',
      subtype: 'energy',
      price: 800,
      currency: 'credits',
      attributes: { energyAmount: 100, count: 5 },
      icon: 'icon-energy',
      rarity: 'common',
      level: 1
    },
    {
      id: 'shop-item-12',
      name: '无敌护盾（1个）',
      description: '5秒内无敌的稀有消耗品。',
      type: 'consumable',
      subtype: 'invincible',
      price: 5000,
      currency: 'credits',
      attributes: { duration: 5, count: 1 },
      icon: 'icon-shield',
      rarity: 'epic',
      level: 10
    },
    {
      id: 'shop-item-13',
      name: '红色涂装',
      description: '为你的战舰更换红色涂装。',
      type: 'cosmetic',
      subtype: 'hull-skin',
      price: 2000,
      currency: 'credits',
      attributes: { texture: 'tex-hull-red' },
      icon: 'icon-character',
      rarity: 'common',
      level: 1
    },
    {
      id: 'shop-item-14',
      name: '蓝色涂装',
      description: '为你的战舰更换蓝色涂装。',
      type: 'cosmetic',
      subtype: 'hull-skin',
      price: 2000,
      currency: 'credits',
      attributes: { texture: 'tex-hull-blue' },
      icon: 'icon-character',
      rarity: 'common',
      level: 1
    },
    {
      id: 'shop-item-15',
      name: '紫色涂装',
      description: '为你的战舰更换紫色涂装。',
      type: 'cosmetic',
      subtype: 'hull-skin',
      price: 2500,
      currency: 'credits',
      attributes: { texture: 'tex-hull-purple' },
      icon: 'icon-character',
      rarity: 'rare',
      level: 5
    },
    {
      id: 'shop-item-16',
      name: '迷彩涂装',
      description: '为你的战舰更换军用迷彩涂装。',
      type: 'cosmetic',
      subtype: 'hull-skin',
      price: 5000,
      currency: 'credits',
      attributes: { texture: 'tex-hull-camo' },
      icon: 'icon-character',
      rarity: 'epic',
      level: 10
    },
    {
      id: 'shop-item-17',
      name: '伤害强化模块',
      description: '永久提升武器伤害10%。',
      type: 'upgrade',
      subtype: 'damage',
      price: 10000,
      currency: 'credits',
      attributes: { damageBonus: 0.1, permanent: true },
      icon: 'icon-damage',
      rarity: 'rare',
      level: 5
    },
    {
      id: 'shop-item-18',
      name: '防御强化模块',
      description: '永久提升护盾值20%。',
      type: 'upgrade',
      subtype: 'defense',
      price: 10000,
      currency: 'credits',
      attributes: { shieldBonus: 0.2, permanent: true },
      icon: 'icon-defense',
      rarity: 'rare',
      level: 5
    },
    {
      id: 'shop-item-19',
      name: '速度强化模块',
      description: '永久提升飞船速度15%。',
      type: 'upgrade',
      subtype: 'speed',
      price: 12000,
      currency: 'credits',
      attributes: { speedBonus: 0.15, permanent: true },
      icon: 'icon-speed',
      rarity: 'rare',
      level: 8
    },
    {
      id: 'shop-item-20',
      name: '能量强化模块',
      description: '永久提升最大能量值30%。',
      type: 'upgrade',
      subtype: 'energy',
      price: 15000,
      currency: 'credits',
      attributes: { energyBonus: 0.3, permanent: true },
      icon: 'icon-energy',
      rarity: 'epic',
      level: 10
    }
  ];

  shopItems.forEach((item, index) => {
    const fileName = `shop-item-${String(index + 1).padStart(2, '0')}.json`;
    const filePath = path.join(shopDir, fileName);
    writeJsonFile(filePath, item, fileName);
  });

  console.log(`Total shop items generated: ${shopItems.length}`);
  return shopItems;
}

// ============================================================
// 6. 更新 manifest.json
// ============================================================
function updateManifest(newCategories) {
  console.log('\n--- Updating Manifest ---');
  const manifestPath = path.join(ASSETS_DIR, 'manifest.json');

  let manifest;
  if (fs.existsSync(manifestPath)) {
    console.log('Reading existing manifest.json...');
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } else {
    console.log('manifest.json not found, creating new one...');
    manifest = {
      version: '2.0.0',
      createdAt: new Date().toISOString(),
      totalSize: 0,
      assetCount: 0,
      categories: []
    };
  }

  // 将新分类添加到清单中（如已存在则替换）
  newCategories.forEach(category => {
    const existingIdx = manifest.categories.findIndex(c => c.id === category.id);
    if (existingIdx >= 0) {
      console.log(`Replacing existing category: ${category.id}`);
      manifest.categories[existingIdx] = category;
    } else {
      console.log(`Adding new category: ${category.id}`);
      manifest.categories.push(category);
    }
  });

  // 重新计算所有资源的大小和总数
  let totalSize = 0;
  let totalCount = 0;
  manifest.categories.forEach(cat => {
    let catSize = 0;
    cat.assets.forEach(asset => {
      const filePath = path.join(ASSETS_DIR, asset.url.replace('/assets/', ''));
      if (fs.existsSync(filePath)) {
        asset.size = fs.statSync(filePath).size;
      }
      catSize += asset.size || 0;
      totalSize += asset.size || 0;
      totalCount++;
    });
    cat.totalSize = catSize;
  });

  manifest.totalSize = totalSize;
  manifest.assetCount = totalCount;
  manifest.createdAt = new Date().toISOString();

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Updated: manifest.json (${totalCount} assets, ${(totalSize / 1024).toFixed(2)} KB)`);
}

// ============================================================
// 主函数
// ============================================================
function main() {
  console.log('=== Generating Story Content ===\n');

  createDirIfNotExists(ASSETS_DIR);

  // 生成所有内容
  const storyChapters = generateStoryChapters();
  const missions = generateMissions();
  const dialogues = generateDialogues();
  const achievements = generateAchievements();
  const shopItems = generateShopItems();

  // 构建要添加到清单中的新分类
  const newCategories = [
    {
      id: 'story',
      name: 'Story Chapters',
      description: '剧情章节',
      assets: storyChapters.map(chapter => ({
        id: chapter.id,
        name: chapter.title,
        type: 'config',
        url: `/assets/story/story-chapter-${String(chapter.number).padStart(2, '0')}.json`,
        size: 0,
        format: 'json',
        tags: ['story', 'chapter']
      })),
      totalSize: 0
    },
    {
      id: 'missions',
      name: 'Missions',
      description: '任务系统',
      assets: missions.map((mission, index) => ({
        id: mission.id,
        name: mission.name,
        type: 'config',
        url: `/assets/missions/mission-${String(index + 1).padStart(2, '0')}.json`,
        size: 0,
        format: 'json',
        tags: ['mission', mission.type]
      })),
      totalSize: 0
    },
    {
      id: 'dialogues',
      name: 'Dialogues',
      description: '对话系统',
      assets: dialogues.map((dialogue, index) => ({
        id: dialogue.id,
        name: dialogue.name,
        type: 'config',
        url: `/assets/dialogues/dialogue-${String(index + 1).padStart(2, '0')}.json`,
        size: 0,
        format: 'json',
        tags: ['dialogue']
      })),
      totalSize: 0
    },
    {
      id: 'achievements',
      name: 'Achievements',
      description: '成就配置',
      assets: achievements.map((achievement, index) => ({
        id: achievement.id,
        name: achievement.name,
        type: 'config',
        url: `/assets/achievements/achievement-${String(index + 1).padStart(2, '0')}.json`,
        size: 0,
        format: 'json',
        tags: ['achievement', achievement.rarity]
      })),
      totalSize: 0
    },
    {
      id: 'shop',
      name: 'Shop Items',
      description: '商店物品',
      assets: shopItems.map((item, index) => ({
        id: item.id,
        name: item.name,
        type: 'config',
        url: `/assets/shop/shop-item-${String(index + 1).padStart(2, '0')}.json`,
        size: 0,
        format: 'json',
        tags: ['shop', item.type, item.rarity]
      })),
      totalSize: 0
    }
  ];

  // 更新清单
  updateManifest(newCategories);

  console.log('\n=== Story Content Generation Complete ===');
  console.log(`Story chapters: ${storyChapters.length}`);
  console.log(`Missions: ${missions.length}`);
  console.log(`Dialogues: ${dialogues.length}`);
  console.log(`Achievements: ${achievements.length}`);
  console.log(`Shop items: ${shopItems.length}`);
}

main();
