import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/shadcn';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/shadcn';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/shadcn';
import { Switch } from './ui/shadcn';
import { Progress } from './ui/shadcn';
import { X, Volume2, Target, Sparkles, Zap, Languages } from 'lucide-react';

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
  particleEffects: true
};

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState<'zh' | 'en'>(() => 
    (localStorage.getItem('language') as 'zh' | 'en') || 'zh'
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

  const updateSetting = useCallback(<K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    saveSettings();
  }, [saveSettings]);

  const changeLanguage = useCallback((lang: 'zh' | 'en') => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
  }, [i18n]);

  const renderAudioSettings = useMemo(() => (
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
  ), [settings, updateSetting, t]);

  const renderGameSettings = useMemo(() => (
    <div className="space-y-6">
      <div className="space-y-3">
        <span className="text-slate-300 font-medium">{t('settings.difficulty')}</span>
        <div className="flex gap-2">
          {(['easy', 'normal', 'hard'] as const).map(diff => (
            <button
              key={diff}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                settings.difficulty === diff
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              onClick={() => updateSetting('difficulty', diff)}
            >
              {diff === 'easy' ? t('settings.easy') : diff === 'normal' ? t('settings.normal') : t('settings.hard')}
            </button>
          ))}
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
          {(['zh', 'en'] as const).map(lang => (
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
  ), [settings, updateSetting, t, language, changeLanguage]);

  const renderVisualSettings = useMemo(() => (
    <div className="space-y-6">
      <div className="space-y-3">
        <span className="text-slate-300 font-medium">{t('settings.quality')}</span>
        <div className="flex gap-2">
          {(['low', 'medium', 'high'] as const).map(quality => (
            <button
              key={quality}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm transition-all ${
                settings.quality === quality
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
              onClick={() => updateSetting('quality', quality)}
            >
              {quality === 'low' ? t('settings.low') : quality === 'medium' ? t('settings.medium') : t('settings.high')}
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
  ), [settings, updateSetting, t]);

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
            <TabsList className="grid w-full grid-cols-3 mb-6">
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
          </Tabs>
        </CardContent>

        <CardFooter className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={onClose}>
            {t('common.close')}
          </Button>
          <Button onClick={() => {
            saveSettings();
            onClose();
          }}>
            {t('settings.saveSettings')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Settings;
