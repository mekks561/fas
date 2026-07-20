import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/shadcn';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/shadcn';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/shadcn';
import { Switch } from './ui/shadcn';
import { Progress } from './ui/shadcn';
import { X, Volume2, Target, Sparkles, Zap, Languages, Sun, Moon, Monitor, Gauge, Gamepad2 } from 'lucide-react';
import { useTheme } from '../store/useTheme';

interface SettingsProps {
  onClose: () => void;
}

interface GameSettings {
  volume: number;
  musicVolume: number;
  sfxVolume: number;
  difficulty: 'easy' | 'normal' | 'hard';
  quality: 'low' | 'medium' | 'high';
  showFPS: boolean;
  showDamageNumbers: boolean;
  screenShake: boolean;
  particleEffects: boolean;
  adaptiveDifficulty: boolean;
  adaptiveIntensity: 'low' | 'medium' | 'high';
}

const defaultSettings: GameSettings = {
  volume: 80,
  musicVolume: 70,
  sfxVolume: 90,
  difficulty: 'normal',
  quality: 'high',
  showFPS: true,
  showDamageNumbers: true,
  screenShake: true,
  particleEffects: true,
  adaptiveDifficulty: true,
  adaptiveIntensity: 'medium',
};

/** 难度预设类型 */
type DifficultyPreset = 'casual' | 'challenge' | 'hardcore';

/** 预设配置：一键应用一组相关设置 */
interface PresetConfig {
  /** 预设标识 */
  id: DifficultyPreset;
  /** 显示名称 */
  label: string;
  /** 简短描述 */
  description: string;
  /** 主题色 Tailwind 类 */
  color: string;
  /** 图标 emoji */
  emoji: string;
  /** 该预设应用的设置覆盖项 */
  overrides: Partial<GameSettings>;
}

const DIFFICULTY_PRESETS: PresetConfig[] = [
  {
    id: 'casual',
    label: '休闲',
    description: '轻松体验剧情，敌人较弱，自适应保守',
    color: 'emerald',
    emoji: '🌿',
    overrides: {
      difficulty: 'easy',
      adaptiveDifficulty: true,
      adaptiveIntensity: 'low',
      screenShake: false,
      showDamageNumbers: true,
      particleEffects: true,
    },
  },
  {
    id: 'challenge',
    label: '挑战',
    description: '标准难度，平衡的战斗与自适应调节',
    color: 'blue',
    emoji: '⚔️',
    overrides: {
      difficulty: 'normal',
      adaptiveDifficulty: true,
      adaptiveIntensity: 'medium',
      screenShake: true,
      showDamageNumbers: true,
      particleEffects: true,
    },
  },
  {
    id: 'hardcore',
    label: '硬核',
    description: '高强度战斗，敌人凶猛，自适应激进',
    color: 'red',
    emoji: '💀',
    overrides: {
      difficulty: 'hard',
      adaptiveDifficulty: true,
      adaptiveIntensity: 'high',
      screenShake: true,
      showDamageNumbers: true,
      particleEffects: true,
    },
  },
];

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const { mode, setThemeMode, availableThemes } = useTheme();

  const [language, setLanguage] = useState<'zh' | 'en'>(
    () => (localStorage.getItem('language') as 'zh' | 'en') || 'zh',
  );

  const [settings, setSettings] = useState<GameSettings>(() => {
    const saved = localStorage.getItem('gameSettings');
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  const saveSettings = useCallback(() => {
    localStorage.setItem('gameSettings', JSON.stringify(settings));
  }, [settings]);

  const updateSetting = useCallback(
    <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: value };
        localStorage.setItem('gameSettings', JSON.stringify(next));
        return next;
      });
    },
    [],
  );

  /** 检测当前设置匹配哪个预设（无匹配返回 null） */
  const detectActivePreset = useCallback((s: GameSettings): DifficultyPreset | null => {
    for (const preset of DIFFICULTY_PRESETS) {
      const keys = Object.keys(preset.overrides) as (keyof GameSettings)[];
      const matches = keys.every((k) => s[k] === preset.overrides[k]);
      if (matches) return preset.id;
    }
    return null;
  }, []);

  const activePreset = useMemo(() => detectActivePreset(settings), [settings, detectActivePreset]);

  /** 应用预设：一键覆盖多项设置 */
  const applyPreset = useCallback((preset: PresetConfig) => {
    setSettings((prev) => {
      const next = { ...prev, ...preset.overrides };
      localStorage.setItem('gameSettings', JSON.stringify(next));
      return next;
    });
  }, []);

  const changeLanguage = useCallback(
    (lang: 'zh' | 'en') => {
      setLanguage(lang);
      i18n.changeLanguage(lang);
      localStorage.setItem('language', lang);
    },
    [i18n],
  );

  const renderAudioSettings = useMemo(
    () => (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">{t('settings.masterVolume')}</span>
            <span className="text-slate-500 text-sm">{settings.volume}%</span>
          </div>
          <Progress value={settings.volume} className="h-2" />
          <input
            type="range"
            min="0"
            max="100"
            value={settings.volume}
            onChange={(e) => updateSetting('volume', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">{t('settings.musicVolume')}</span>
            <span className="text-slate-500 text-sm">{settings.musicVolume}%</span>
          </div>
          <Progress value={settings.musicVolume} className="h-2 bg-blue-500" />
          <input
            type="range"
            min="0"
            max="100"
            value={settings.musicVolume}
            onChange={(e) => updateSetting('musicVolume', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-300 font-medium">{t('settings.sfxVolume')}</span>
            <span className="text-slate-500 text-sm">{settings.sfxVolume}%</span>
          </div>
          <Progress value={settings.sfxVolume} className="h-2 bg-yellow-500" />
          <input
            type="range"
            min="0"
            max="100"
            value={settings.sfxVolume}
            onChange={(e) => updateSetting('sfxVolume', parseInt(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
          />
        </div>
      </div>
    ),
    [settings, updateSetting, t],
  );

  const renderGameSettings = useMemo(
    () => (
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300 font-medium">难度预设</span>
          </div>
          <div className="text-xs text-slate-500 mb-2">一键应用一组难度相关配置</div>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_PRESETS.map((preset) => {
              const isActive = activePreset === preset.id;
              const colorMap: Record<string, { active: string; idle: string }> = {
                emerald: {
                  active: 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 border-emerald-400',
                  idle: 'bg-slate-800 text-slate-400 hover:bg-slate-700 border-slate-700',
                },
                blue: {
                  active: 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 border-blue-400',
                  idle: 'bg-slate-800 text-slate-400 hover:bg-slate-700 border-slate-700',
                },
                red: {
                  active: 'bg-red-600 text-white shadow-lg shadow-red-500/30 border-red-400',
                  idle: 'bg-slate-800 text-slate-400 hover:bg-slate-700 border-slate-700',
                },
              };
              const colors = colorMap[preset.color] || colorMap['blue'];
              return (
                <button
                  key={preset.id}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-lg border transition-all ${isActive ? colors.active : colors.idle}`}
                  onClick={() => applyPreset(preset)}
                  title={preset.description}
                >
                  <span className="text-2xl">{preset.emoji}</span>
                  <span className="text-sm font-bold">{preset.label}</span>
                </button>
              );
            })}
          </div>
          {activePreset && (
            <div className="text-xs text-slate-400 mt-1">
              {DIFFICULTY_PRESETS.find((p) => p.id === activePreset)?.description}
            </div>
          )}
          {!activePreset && (
            <div className="text-xs text-amber-400/70 mt-1">自定义配置</div>
          )}
        </div>

        <div className="space-y-3 pt-2 border-t border-slate-800">
          <span className="text-slate-300 font-medium">{t('settings.difficulty')}</span>
          <div className="flex gap-2">
            {(['easy', 'normal', 'hard'] as const).map((diff) => (
              <button
                key={diff}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                  settings.difficulty === diff
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                onClick={() => updateSetting('difficulty', diff)}
              >
                {diff === 'easy'
                  ? t('settings.easy')
                  : diff === 'normal'
                    ? t('settings.normal')
                    : t('settings.hard')}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 pt-2 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300 font-medium">自适应难度</span>
            </div>
            <Switch
              checked={settings.adaptiveDifficulty}
              onCheckedChange={(checked) => updateSetting('adaptiveDifficulty', checked)}
            />
          </div>

          <div className={`space-y-3 pl-6 transition-opacity ${settings.adaptiveDifficulty ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
            <div className="text-sm text-slate-400">
              系统会根据你的实时表现（击杀速率、受伤程度、生存时间）动态调整敌人强度。
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">自适应强度</span>
                <span className="text-xs text-slate-500">
                  {settings.adaptiveIntensity === 'low'
                    ? '弱（波动 ±10%）'
                    : settings.adaptiveIntensity === 'medium'
                      ? '中（波动 ±25%）'
                      : '强（波动 ±40%）'}
                </span>
              </div>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((intensity) => (
                  <button
                    key={intensity}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium text-xs transition-all ${
                      settings.adaptiveIntensity === intensity
                        ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/30'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                    onClick={() => updateSetting('adaptiveIntensity', intensity)}
                  >
                    {intensity === 'low' ? '弱' : intensity === 'medium' ? '中' : '强'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-b border-slate-800">
          <span className="text-slate-300 font-medium">{t('settings.showFPS')}</span>
          <Switch
            checked={settings.showFPS}
            onCheckedChange={(checked) => updateSetting('showFPS', checked)}
          />
        </div>

        <div className="flex items-center justify-between py-3 border-b border-slate-800">
          <span className="text-slate-300 font-medium">{t('settings.showDamageNumbers')}</span>
          <Switch
            checked={settings.showDamageNumbers}
            onCheckedChange={(checked) => updateSetting('showDamageNumbers', checked)}
          />
        </div>

        <div className="flex items-center justify-between py-3 border-b border-slate-800">
          <span className="text-slate-300 font-medium">{t('settings.screenShake')}</span>
          <Switch
            checked={settings.screenShake}
            onCheckedChange={(checked) => updateSetting('screenShake', checked)}
          />
        </div>

        <div className="space-y-3 pt-3">
          <div className="flex items-center gap-2">
            <Languages className="w-4 h-4 text-slate-400" />
            <span className="text-slate-300 font-medium">{t('settings.language')}</span>
          </div>
          <div className="flex gap-2">
            {(['zh', 'en'] as const).map((lang) => (
              <button
                key={lang}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                  language === lang
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                onClick={() => changeLanguage(lang)}
              >
                {lang === 'zh' ? t('settings.languageZh') : t('settings.languageEn')}
              </button>
            ))}
          </div>
        </div>
      </div>
    ),
    [settings, updateSetting, t, language, changeLanguage, activePreset, applyPreset],
  );

  const renderVisualSettings = useMemo(
    () => (
      <div className="space-y-6">
        <div className="space-y-3">
          <span className="text-slate-300 font-medium">{t('settings.quality')}</span>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map((quality) => (
              <button
                key={quality}
                className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                  settings.quality === quality
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                onClick={() => updateSetting('quality', quality)}
              >
                {quality === 'low'
                  ? t('settings.low')
                  : quality === 'medium'
                    ? t('settings.medium')
                    : t('settings.high')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between py-3">
          <span className="text-slate-300 font-medium">{t('settings.particleEffects')}</span>
          <Switch
            checked={settings.particleEffects}
            onCheckedChange={(checked) => updateSetting('particleEffects', checked)}
          />
        </div>
      </div>
    ),
    [settings, updateSetting, t],
  );

  const renderThemeSettings = useMemo(
    () => (
      <div className="space-y-6">
        <div className="space-y-3">
          <span className="text-slate-300 font-medium">{t('settings.theme')}</span>
          <div className="grid grid-cols-3 gap-2">
            {availableThemes.map((themeOption) => (
              <button
                key={themeOption.mode}
                className={`flex flex-col items-center justify-center py-4 px-3 rounded-lg font-medium text-sm transition-all ${
                  mode === themeOption.mode
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
                onClick={() => setThemeMode(themeOption.mode)}
              >
                {themeOption.mode === 'dark' && <Moon className="w-5 h-5 mb-2" />}
                {themeOption.mode === 'light' && <Sun className="w-5 h-5 mb-2" />}
                {themeOption.mode === 'system' && <Monitor className="w-5 h-5 mb-2" />}
                {themeOption.mode === 'dark'
                  ? t('settings.dark')
                  : themeOption.mode === 'light'
                    ? t('settings.light')
                    : t('settings.system')}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" />
            <span className="text-slate-300 font-medium">{t('settings.currentTheme')}</span>
          </div>
          <p className="text-sm text-slate-500">
            {mode === 'dark'
              ? t('settings.themeDarkDesc')
              : mode === 'light'
                ? t('settings.themeLightDesc')
                : t('settings.themeSystemDesc')}
          </p>
        </div>
      </div>
    ),
    [mode, setThemeMode, availableThemes, t],
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className="w-full max-w-lg bg-slate-900/95 border-slate-700 shadow-2xl">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            {t('settings.title')}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>

        <CardContent className="pt-4">
          <Tabs defaultValue="audio" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="audio" className="gap-2">
                <Volume2 className="w-4 h-4" />
                {t('settings.audio')}
              </TabsTrigger>
              <TabsTrigger value="game" className="gap-2">
                <Target className="w-4 h-4" />
                {t('settings.game')}
              </TabsTrigger>
              <TabsTrigger value="visual" className="gap-2">
                <Zap className="w-4 h-4" />
                {t('settings.visual')}
              </TabsTrigger>
              <TabsTrigger value="theme" className="gap-2">
                <Sun className="w-4 h-4" />
                {t('settings.theme')}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="audio" className="mt-0">
              {renderAudioSettings}
            </TabsContent>
            <TabsContent value="game" className="mt-0">
              {renderGameSettings}
            </TabsContent>
            <TabsContent value="visual" className="mt-0">
              {renderVisualSettings}
            </TabsContent>
            <TabsContent value="theme" className="mt-0">
              {renderThemeSettings}
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button
            onClick={() => {
              saveSettings();
              onClose();
            }}
          >
            {t('settings.saveSettings')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Settings;
