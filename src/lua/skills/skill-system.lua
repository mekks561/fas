--[[
==========================================
技能系统 - Skill System
Fighter Game Lua Script Module

功能概述:
- 技能定义和管理
- 技能效果计算（伤害、治疗、buff）
- 技能冷却和资源管理
- 技能组合系统（连招）
- 被动技能触发机制

作者: Fighter Game Team
版本: 1.0.0
最后更新: 2026-06-28
==========================================
]]--

-- ==========================================
-- 模块初始化
-- ==========================================

local SkillSystem = {}

-- 版本信息
SkillSystem.VERSION = "1.0.0"
SkillSystem.AUTHOR = "Fighter Game Team"

-- ==========================================
-- 常量定义
-- ==========================================

-- 技能类型枚举
SkillSystem.SkillType = {
    ACTIVE = "active",       -- 主动技能（需要手动触发）
    PASSIVE = "passive",     -- 被动技能（自动触发）
    TOGGLE = "toggle",       -- 切换技能（开关状态）
    ULTIMATE = "ultimate"    -- 终极技能（高消耗大效果）
}

-- 技能效果类型
SkillSystem.EffectType = {
    DAMAGE = "damage",           -- 直接伤害
    DAMAGE_OVER_TIME = "dot",    -- 持续伤害
    HEAL = "heal",               -- 治疗
    HEAL_OVER_TIME = "hot",      -- 持续治疗
    BUFF = "buff",               -- 增益效果
    DEBUFF = "debuff",           -- 减益效果
    SHIELD = "shield",           -- 护盾
    STUN = "stun",               -- 眩晕
    KNOCKBACK = "knockback",     -- 击退
    SUMMON = "summon",           -- 召唤
    AREA = "area"                -- 范围效果
}

-- 资源类型
SkillSystem.ResourceType = {
    MANA = "mana",           -- 能量值
    ENERGY = "energy",       -- 体力值
    HEALTH = "health",       -- 血量消耗
    COOLDOWN = "cooldown",   -- 冷却时间
    CHARGE = "charge"        -- 蓄力次数
}

-- 技能状态
SkillSystem.SkillState = {
    READY = "ready",         -- 可使用
    COOLDOWN = "cooldown",   -- 冷却中
    ACTIVE = "active",       -- 正在执行
    DISABLED = "disabled",   -- 禁用
    LOCKED = "locked"        -- 未解锁
}

-- ==========================================
-- 技能定义模板
-- ==========================================

--[[
技能数据结构:
{
    id: string              -- 技能唯一标识
    name: string            -- 技能名称
    description: string     -- 技能描述
    type: SkillType         -- 技能类型
    effects: table          -- 效果列表
    cost: table             -- 资源消耗
    cooldown: number        -- 冷却时间（秒）
    range: number           -- 施放范围
    duration: number        -- 持续时间（秒）
    icon: string            -- 图标标识
    level: number           -- 当前等级
    maxLevel: number        -- 最大等级
    unlockLevel: number     -- 解锁所需角色等级
    prerequisites: table    -- 前置技能
}
]]--

-- 预定义技能模板
SkillSystem.SkillTemplates = {
    -- === 主动技能 === --
    
    -- 基础攻击技能
    BASIC_ATTACK = {
        id = "basic_attack",
        name = "基础攻击",
        description = "发射一枚普通弹丸",
        type = SkillSystem.SkillType.ACTIVE,
        effects = {
            { type = SkillSystem.EffectType.DAMAGE, value = 10, scaling = 1.0 }
        },
        cost = { type = SkillSystem.ResourceType.ENERGY, value = 0 },
        cooldown = 0.5,
        range = 100,
        duration = 0,
        icon = "attack_basic",
        level = 1,
        maxLevel = 10,
        unlockLevel = 1,
        prerequisites = {}
    },
    
    -- 强力射击
    POWER_SHOT = {
        id = "power_shot",
        name = "强力射击",
        description = "发射高伤害弹丸，穿透敌人",
        type = SkillSystem.SkillType.ACTIVE,
        effects = {
            { type = SkillSystem.EffectType.DAMAGE, value = 50, scaling = 1.5 },
            { type = SkillSystem.EffectType.KNOCKBACK, value = 5, scaling = 0.5 }
        },
        cost = { type = SkillSystem.ResourceType.ENERGY, value = 20 },
        cooldown = 3.0,
        range = 150,
        duration = 0,
        icon = "attack_power",
        level = 1,
        maxLevel = 5,
        unlockLevel = 5,
        prerequisites = { "basic_attack" }
    },
    
    -- 散射弹幕
    SPREAD_SHOT = {
        id = "spread_shot",
        name = "散射弹幕",
        description = "向前发射5枚弹丸，覆盖扇形区域",
        type = SkillSystem.SkillType.ACTIVE,
        effects = {
            { type = SkillSystem.EffectType.AREA, radius = 30, angle = 60 },
            { type = SkillSystem.EffectType.DAMAGE, value = 8, scaling = 0.8, count = 5 }
        },
        cost = { type = SkillSystem.ResourceType.ENERGY, value = 30 },
        cooldown = 2.0,
        range = 80,
        duration = 0,
        icon = "attack_spread",
        level = 1,
        maxLevel = 5,
        unlockLevel = 10,
        prerequisites = { "basic_attack" }
    },
    
    -- === 治疗技能 === --
    
    -- 快速恢复
    QUICK_HEAL = {
        id = "quick_heal",
        name = "快速恢复",
        description = "立即恢复一定血量",
        type = SkillSystem.SkillType.ACTIVE,
        effects = {
            { type = SkillSystem.EffectType.HEAL, value = 25, scaling = 1.0 }
        },
        cost = { type = SkillSystem.ResourceType.MANA, value = 15 },
        cooldown = 5.0,
        range = 0,  -- 自身
        duration = 0,
        icon = "heal_quick",
        level = 1,
        maxLevel = 5,
        unlockLevel = 3,
        prerequisites = {}
    },
    
    -- 持续治疗
    REGEN_AURA = {
        id = "regen_aura",
        name = "恢复光环",
        description = "持续恢复血量，持续5秒",
        type = SkillSystem.SkillType.ACTIVE,
        effects = {
            { type = SkillSystem.EffectType.HEAL_OVER_TIME, value = 5, scaling = 1.0, ticks = 5, interval = 1.0 }
        },
        cost = { type = SkillSystem.ResourceType.MANA, value = 30 },
        cooldown = 10.0,
        range = 0,
        duration = 5.0,
        icon = "heal_regen",
        level = 1,
        maxLevel = 5,
        unlockLevel = 8,
        prerequisites = { "quick_heal" }
    },
    
    -- === Buff技能 === --
    
    -- 速度提升
    SPEED_BOOST = {
        id = "speed_boost",
        name = "疾风加速",
        description = "移动速度提升50%，持续8秒",
        type = SkillSystem.SkillType.ACTIVE,
        effects = {
            { type = SkillSystem.EffectType.BUFF, stat = "speed", value = 50, scaling = 0, unit = "percent" }
        },
        cost = { type = SkillSystem.ResourceType.ENERGY, value = 20 },
        cooldown = 15.0,
        range = 0,
        duration = 8.0,
        icon = "buff_speed",
        level = 1,
        maxLevel = 5,
        unlockLevel = 5,
        prerequisites = {}
    },
    
    -- 护盾
    SHIELD = {
        id = "shield",
        name = "能量护盾",
        description = "生成护盾吸收伤害",
        type = SkillSystem.SkillType.ACTIVE,
        effects = {
            { type = SkillSystem.EffectType.SHIELD, value = 50, scaling = 1.2 }
        },
        cost = { type = SkillSystem.ResourceType.MANA, value = 40 },
        cooldown = 20.0,
        range = 0,
        duration = 10.0,
        icon = "buff_shield",
        level = 1,
        maxLevel = 5,
        unlockLevel = 12,
        prerequisites = {}
    },
    
    -- === 终极技能 === --
    
    -- 终极爆发
    ULTIMATE_BURST = {
        id = "ultimate_burst",
        name = "终极爆发",
        description = "释放全部能量，造成巨大范围伤害",
        type = SkillSystem.SkillType.ULTIMATE,
        effects = {
            { type = SkillSystem.EffectType.AREA, radius = 100 },
            { type = SkillSystem.EffectType.DAMAGE, value = 200, scaling = 2.0 }
        },
        cost = { type = SkillSystem.ResourceType.MANA, value = 100 },
        cooldown = 60.0,
        range = 0,
        duration = 0.5,
        icon = "ultimate_burst",
        level = 1,
        maxLevel = 3,
        unlockLevel = 20,
        prerequisites = { "power_shot", "spread_shot" }
    },
    
    -- === 被动技能 === --
    
    -- 攻击强化
    ATTACK_BOOST_PASSIVE = {
        id = "attack_boost_passive",
        name = "攻击强化",
        description = "永久提升基础攻击伤害",
        type = SkillSystem.SkillType.PASSIVE,
        effects = {
            { type = SkillSystem.EffectType.BUFF, stat = "damage", value = 10, scaling = 0, unit = "flat" }
        },
        cost = {},
        cooldown = 0,
        range = 0,
        duration = -1,  -- 永久
        icon = "passive_attack",
        level = 1,
        maxLevel = 10,
        unlockLevel = 2,
        prerequisites = {}
    },
    
    -- 血量提升
    HEALTH_BOOST_PASSIVE = {
        id = "health_boost_passive",
        name = "生命强化",
        description = "永久提升最大血量",
        type = SkillSystem.SkillType.PASSIVE,
        effects = {
            { type = SkillSystem.EffectType.BUFF, stat = "maxHealth", value = 20, scaling = 0, unit = "flat" }
        },
        cost = {},
        cooldown = 0,
        range = 0,
        duration = -1,
        icon = "passive_health",
        level = 1,
        maxLevel = 10,
        unlockLevel = 4,
        prerequisites = {}
    },
    
    -- 暴击几率
    CRITICAL_PASSIVE = {
        id = "critical_passive",
        name = "暴击精通",
        description = "提升暴击几率和暴击伤害",
        type = SkillSystem.SkillType.PASSIVE,
        effects = {
            { type = SkillSystem.EffectType.BUFF, stat = "critChance", value = 5, scaling = 0, unit = "percent" },
            { type = SkillSystem.EffectType.BUFF, stat = "critDamage", value = 10, scaling = 0, unit = "percent" }
        },
        cost = {},
        cooldown = 0,
        range = 0,
        duration = -1,
        icon = "passive_crit",
        level = 1,
        maxLevel = 5,
        unlockLevel = 10,
        prerequisites = { "attack_boost_passive" }
    }
}

-- ==========================================
-- 技能实例管理
-- ==========================================

-- 已学习技能存储
SkillSystem.LearnedSkills = {}

-- 技能冷却追踪
SkillSystem.CooldownTracker = {}

-- 技能效果追踪（持续效果）
SkillSystem.ActiveEffects = {}

-- ==========================================
-- 核心功能函数
-- ==========================================

--[[
创建技能实例
@param skillId: string - 技能模板ID
@return: table - 技能实例，失败返回nil
]]--
function SkillSystem.createSkill(skillId)
    -- 参数验证
    if type(skillId) ~= "string" then
        error("SkillSystem.createSkill: skillId must be a string")
        return nil
    end
    
    -- 查找模板
    local template = SkillSystem.SkillTemplates[skillId]
    if not template then
        error("SkillSystem.createSkill: unknown skill template '" .. skillId .. "'")
        return nil
    end
    
    -- 创建实例（深拷贝模板）
    local skill = {}
    for key, value in pairs(template) do
        if type(value) == "table" then
            skill[key] = {}
            for k, v in pairs(value) do
                skill[key][k] = v
            end
        else
            skill[key] = value
        end
    end
    
    -- 初始化实例属性
    skill.state = SkillSystem.SkillState.LOCKED
    skill.currentCooldown = 0
    skill.castTime = 0
    skill.lastCastTime = 0
    
    return skill
end

--[[
学习技能
@param skillId: string - 技能ID
@param playerLevel: number - 角色等级
@param learnedSkillIds: table - 已学习技能ID列表
@return: boolean - 是否成功学习
]]--
function SkillSystem.learnSkill(skillId, playerLevel, learnedSkillIds)
    -- 参数验证
    if type(skillId) ~= "string" then
        error("SkillSystem.learnSkill: skillId must be a string")
        return false
    end
    
    if type(playerLevel) ~= "number" or playerLevel < 0 then
        error("SkillSystem.learnSkill: playerLevel must be a positive number")
        return false
    end
    
    -- 创建技能实例
    local skill = SkillSystem.createSkill(skillId)
    if not skill then return false end
    
    -- 检查解锁条件
    if playerLevel < skill.unlockLevel then
        return false, "需要角色等级 " .. skill.unlockLevel
    end
    
    -- 检查前置技能
    for _, prereqId in ipairs(skill.prerequisites) do
        local hasPrereq = false
        for _, learnedId in ipairs(learnedSkillIds or {}) do
            if learnedId == prereqId then
                hasPrereq = true
                break
            end
        end
        if not hasPrereq then
            return false, "需要前置技能: " .. prereqId
        end
    end
    
    -- 学习成功
    skill.state = SkillSystem.SkillState.READY
    SkillSystem.LearnedSkills[skillId] = skill
    
    return true
end

--[[
升级技能
@param skillId: string - 技能ID
@return: boolean, number - 是否成功，新等级
]]--
function SkillSystem.upgradeSkill(skillId)
    -- 参数验证
    if type(skillId) ~= "string" then
        error("SkillSystem.upgradeSkill: skillId must be a string")
        return false, 0
    end
    
    local skill = SkillSystem.LearnedSkills[skillId]
    if not skill then
        return false, 0
    end
    
    -- 检查等级上限
    if skill.level >= skill.maxLevel then
        return false, skill.level
    end
    
    -- 升级
    skill.level = skill.level + 1
    
    -- 更新效果值（基于等级缩放）
    for _, effect in ipairs(skill.effects) do
        if effect.scaling > 0 then
            effect.value = effect.value + math.floor(effect.value * 0.1)
        end
    end
    
    -- 减少冷却时间
    if skill.cooldown > 0 then
        skill.cooldown = math.max(0.5, skill.cooldown * 0.95)
    end
    
    return true, skill.level
end

--[[
检查技能是否可用
@param skillId: string - 技能ID
@param resources: table - 当前资源 { mana, energy, health, charge }
@return: boolean, string - 是否可用，不可用原因
]]--
function SkillSystem.canCastSkill(skillId, resources)
    -- 参数验证
    if type(skillId) ~= "string" then
        error("SkillSystem.canCastSkill: skillId must be a string")
        return false, "invalid_skill_id"
    end
    
    if type(resources) ~= "table" then
        error("SkillSystem.canCastSkill: resources must be a table")
        return false, "invalid_resources"
    end
    
    local skill = SkillSystem.LearnedSkills[skillId]
    if not skill then
        return false, "skill_not_learned"
    end
    
    -- 检查状态
    if skill.state == SkillSystem.SkillState.LOCKED then
        return false, "skill_locked"
    end
    
    if skill.state == SkillSystem.SkillState.DISABLED then
        return false, "skill_disabled"
    end
    
    -- 检查冷却
    if skill.currentCooldown > 0 then
        return false, "cooldown_active"
    end
    
    -- 检查资源消耗
    local cost = skill.cost
    if cost and cost.type and cost.value > 0 then
        local currentResource = resources[cost.type] or 0
        if currentResource < cost.value then
            return false, "insufficient_resource"
        end
    end
    
    return true, "ready"
end

--[[
施放技能
@param skillId: string - 技能ID
@param caster: table - 施放者信息 { x, y, stats }
@param target: table - 目标信息 { x, y } 或 nil（自身技能）
@param resources: table - 当前资源
@return: table - 施放结果
]]--
function SkillSystem.castSkill(skillId, caster, target, resources)
    -- 参数验证
    if type(skillId) ~= "string" then
        error("SkillSystem.castSkill: skillId must be a string")
        return { success = false, error = "invalid_skill_id" }
    end
    
    if type(caster) ~= "table" then
        error("SkillSystem.castSkill: caster must be a table")
        return { success = false, error = "invalid_caster" }
    end
    
    -- 检查是否可用
    local canCast, reason = SkillSystem.canCastSkill(skillId, resources)
    if not canCast then
        return { success = false, error = reason }
    end
    
    local skill = SkillSystem.LearnedSkills[skillId]
    
    -- 消耗资源
    local cost = skill.cost
    if cost and cost.type and cost.value > 0 then
        resources[cost.type] = resources[cost.type] - cost.value
    end
    
    -- 开始冷却
    skill.currentCooldown = skill.cooldown
    skill.state = SkillSystem.SkillState.COOLDOWN
    skill.lastCastTime = os.time()
    
    -- 计算效果
    local effects = SkillSystem.calculateEffects(skill, caster, target)
    
    -- 返回结果
    return {
        success = true,
        skillId = skillId,
        skillName = skill.name,
        effects = effects,
        remainingCooldown = skill.cooldown,
        costPaid = cost and cost.value or 0
    }
end

--[[
计算技能效果
@param skill: table - 技能实例
@param caster: table - 施放者
@param target: table - 目标
@return: table - 效果列表
]]--
function SkillSystem.calculateEffects(skill, caster, target)
    local results = {}
    
    for i, effect in ipairs(skill.effects) do
        local result = {
            type = effect.type,
            source = caster,
            target = target,
            level = skill.level
        }
        
        -- 基础值计算
        local baseValue = effect.value or 0
        
        -- 等级缩放
        local levelScaling = 1 + (skill.level - 1) * 0.1
        
        -- 施放者属性缩放
        local statScaling = 1.0
        if effect.scaling > 0 and caster.stats then
            local relevantStat = caster.stats.damage or caster.stats.attack or 0
            statScaling = 1 + (relevantStat * effect.scaling * 0.01)
        end
        
        -- 暴击检查
        local isCritical = false
        local critMultiplier = 1.0
        if caster.stats and caster.stats.critChance and effect.type == SkillSystem.EffectType.DAMAGE then
            if math.random() * 100 < (caster.stats.critChance or 0) then
                isCritical = true
                critMultiplier = 1 + (caster.stats.critDamage or 50) / 100
            end
        end
        
        -- 最终值
        result.value = math.floor(baseValue * levelScaling * statScaling * critMultiplier)
        result.isCritical = isCritical
        
        -- 持续效果信息
        if effect.type == SkillSystem.EffectType.DAMAGE_OVER_TIME or
           effect.type == SkillSystem.EffectType.HEAL_OVER_TIME then
            result.ticks = effect.ticks or 5
            result.interval = effect.interval or 1.0
            result.tickValue = math.floor(result.value / result.ticks)
        end
        
        -- 范围效果信息
        if effect.type == SkillSystem.EffectType.AREA then
            result.radius = effect.radius or 50
            result.angle = effect.angle or 360
        end
        
        -- Buff/Debuff 信息
        if effect.type == SkillSystem.EffectType.BUFF or effect.type == SkillSystem.EffectType.DEBUFF then
            result.stat = effect.stat
            result.unit = effect.unit or "flat"
            result.duration = skill.duration
        end
        
        results[i] = result
    end
    
    return results
end

--[[
更新冷却时间
@param deltaTime: number - 时间步长（秒）
@return: table - 恢复就绪的技能ID列表
]]--
function SkillSystem.updateCooldowns(deltaTime)
    -- 参数验证
    if type(deltaTime) ~= "number" or deltaTime < 0 then
        error("SkillSystem.updateCooldowns: deltaTime must be a positive number")
        return {}
    end
    
    local readySkills = {}
    
    for skillId, skill in pairs(SkillSystem.LearnedSkills) do
        if skill.state == SkillSystem.SkillState.COOLDOWN then
            skill.currentCooldown = math.max(0, skill.currentCooldown - deltaTime)
            
            -- 冷却结束
            if skill.currentCooldown <= 0 then
                skill.state = SkillSystem.SkillState.READY
                skill.currentCooldown = 0
                readySkills[#readySkills + 1] = skillId
            end
        end
    end
    
    return readySkills
end

--[[
获取技能状态
@param skillId: string - 技能ID
@return: table - 技能状态信息
]]--
function SkillSystem.getSkillStatus(skillId)
    local skill = SkillSystem.LearnedSkills[skillId]
    if not skill then
        return nil
    end
    
    return {
        id = skillId,
        name = skill.name,
        state = skill.state,
        level = skill.level,
        maxLevel = skill.maxLevel,
        currentCooldown = skill.currentCooldown,
        cooldownPercent = (skill.cooldown > 0) and (skill.currentCooldown / skill.cooldown * 100) or 0,
        cost = skill.cost,
        effects = skill.effects
    }
end

--[[
获取所有已学习技能状态
@return: table - 技能状态列表
]]--
function SkillSystem.getAllSkillStatus()
    local statuses = {}
    
    for skillId, _ in pairs(SkillSystem.LearnedSkills) do
        statuses[#statuses + 1] = SkillSystem.getSkillStatus(skillId)
    end
    
    return statuses
end

--[[
重置技能冷却（特殊情况使用）
@param skillId: string - 技能ID
@return: boolean - 是否成功
]]--
function SkillSystem.resetCooldown(skillId)
    local skill = SkillSystem.LearnedSkills[skillId]
    if not skill then return false end
    
    skill.currentCooldown = 0
    skill.state = SkillSystem.SkillState.READY
    
    return true
end

--[[
获取技能伤害预览
@param skillId: string - 技能ID
@param casterStats: table - 施放者属性
@return: number - 预估伤害值
]]--
function SkillSystem.getSkillDamagePreview(skillId, casterStats)
    local skill = SkillSystem.LearnedSkills[skillId]
    if not skill then return 0 end
    
    local totalDamage = 0
    
    for _, effect in ipairs(skill.effects) do
        if effect.type == SkillSystem.EffectType.DAMAGE then
            local baseDamage = effect.value
            local levelBonus = (skill.level - 1) * 0.1
            local statBonus = (casterStats.damage or 0) * (effect.scaling or 0) * 0.01
            
            totalDamage = totalDamage + math.floor(baseDamage * (1 + levelBonus + statBonus))
        end
    end
    
    return totalDamage
end

-- ==========================================
-- 技能组合系统（连招）
-- ==========================================

--[[
技能组合定义
]]--
SkillSystem.SkillCombos = {
    RAPID_FIRE = {
        name = "快速连射",
        skills = { "basic_attack", "basic_attack", "basic_attack", "power_shot" },
        timingWindow = 1.0,  -- 每个技能必须在1秒内接上
        bonusEffect = { type = "damage", multiplier = 1.5 },
        description = "连续基础攻击后接强力射击，伤害提升50%"
    },
    
    HEAL_COMBO = {
        name = "治疗连击",
        skills = { "quick_heal", "regen_aura" },
        timingWindow = 2.0,
        bonusEffect = { type = "heal", multiplier = 1.3 },
        description = "快速治疗后接持续治疗，效果提升30%"
    },
    
    ULTIMATE_SETUP = {
        name = "终极蓄力",
        skills = { "spread_shot", "speed_boost", "shield", "ultimate_burst" },
        timingWindow = 3.0,
        bonusEffect = { type = "damage", multiplier = 2.0 },
        description = "完整连招后终极技能伤害翻倍"
    }
}

-- 当前连招追踪
SkillSystem.ActiveCombo = {
    currentSequence = {},
    startTime = 0,
    lastSkillTime = 0
}

--[[
开始连招追踪
@return: boolean - 是否成功开始
]]--
function SkillSystem.startCombo()
    SkillSystem.ActiveCombo = {
        currentSequence = {},
        startTime = os.time(),
        lastSkillTime = 0
    }
    return true
end

--[[
添加技能到连招序列
@param skillId: string - 技能ID
@return: boolean, string - 是否成功添加，当前连招名称
]]--
function SkillSystem.addToCombo(skillId)
    local combo = SkillSystem.ActiveCombo
    local currentTime = os.time()
    
    -- 检查时间窗口
    if combo.lastSkillTime > 0 and (currentTime - combo.lastSkillTime) > combo.timingWindow then
        -- 连招超时，重置
        SkillSystem.startCombo()
    end
    
    -- 添加技能
    combo.currentSequence[#combo.currentSequence + 1] = skillId
    combo.lastSkillTime = currentTime
    
    -- 检查是否完成连招
    for comboId, comboDef in pairs(SkillSystem.SkillCombos) do
        local matches = true
        for i, expectedSkill in ipairs(comboDef.skills) do
            if combo.currentSequence[i] ~= expectedSkill then
                matches = false
                break
            end
        end
        
        if matches and #combo.currentSequence == #comboDef.skills then
            -- 连招完成
            return true, comboDef.name
        end
    end
    
    return true, "combo_in_progress"
end

--[[
检查连招奖励
@return: table - 奖励效果，nil表示无奖励
]]--
function SkillSystem.checkComboBonus()
    local combo = SkillSystem.ActiveCombo
    
    for comboId, comboDef in pairs(SkillSystem.SkillCombos) do
        local matches = true
        for i, expectedSkill in ipairs(comboDef.skills) do
            if combo.currentSequence[i] ~= expectedSkill then
                matches = false
                break
            end
        end
        
        if matches and #combo.currentSequence == #comboDef.skills then
            return comboDef.bonusEffect
        end
    end
    
    return nil
end

-- ==========================================
-- 导出模块
-- ==========================================

return SkillSystem