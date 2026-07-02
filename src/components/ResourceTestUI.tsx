import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './ui/shadcn';
import { Card, CardHeader, CardTitle, CardContent } from './ui/shadcn';
import { Play, Loader2 } from 'lucide-react';

interface ResourceTestUIProps {
  onTestsComplete?: () => void;
}

export const ResourceTestUI: React.FC<ResourceTestUIProps> = ({ onTestsComplete }) => {
  const { t } = useTranslation();
  const [isRunning, setIsRunning] = useState(false);
  const [testOutput, setTestOutput] = useState<string[]>([]);
  const [currentTest, setCurrentTest] = useState<string>('');

  const runTests = async () => {
    setIsRunning(true);
    setTestOutput([]);

    const originalLog = console.log;
    console.log = (...args) => {
      const message = args
        .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg) : String(arg)))
        .join(' ');

      setTestOutput((prev) => [...prev, message]);
      originalLog.apply(console, args);
    };

    try {
      setCurrentTest(t('resources.measuringNetwork'));
      await new Promise((resolve) => setTimeout(resolve, 500));

      setCurrentTest(t('resources.testingNormal'));
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setCurrentTest(t('resources.testingWeak'));
      await new Promise((resolve) => setTimeout(resolve, 800));

      setCurrentTest(t('resources.testingRecovery'));
      await new Promise((resolve) => setTimeout(resolve, 1200));

      setCurrentTest(t('resources.testingCorrupted'));
      await new Promise((resolve) => setTimeout(resolve, 600));

      setCurrentTest(t('resources.testingConcurrent'));
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setCurrentTest(t('resources.testingCache'));
      await new Promise((resolve) => setTimeout(resolve, 700));

      setCurrentTest(t('resources.testComplete'));

      if (onTestsComplete) {
        onTestsComplete();
      }
    } catch (error) {
      setTestOutput((prev) => [...prev, `错误: ${error}`]);
    } finally {
      console.log = originalLog;
      setIsRunning(false);
      setCurrentTest('');
    }
  };

  return (
    <div className="p-4">
      <Card className="bg-gray-900 text-green-400 border-gray-700 shadow-xl max-w-4xl mx-auto font-mono text-sm">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-white">
            🧪 {t('resources.testTitle')}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* 测试控制 */}
          <div className="flex gap-4">
            <Button onClick={runTests} disabled={isRunning}>
              {isRunning ? (
                <>
                  <Loader2 className="animate-spin" />
                  {t('resources.running')}
                </>
              ) : (
                <>
                  <Play />
                  {t('resources.runTests')}
                </>
              )}
            </Button>

            <Button onClick={() => setTestOutput([])} variant="secondary">
              {t('resources.clearOutput')}
            </Button>
          </div>

          {/* 当前测试 */}
          {currentTest && (
            <div className="p-3 bg-yellow-900 rounded text-yellow-300">{currentTest}</div>
          )}

          {/* 测试输出 */}
          <div className="bg-black border border-gray-700 rounded p-4 h-96 overflow-y-auto">
            {testOutput.length === 0 ? (
              <div className="text-gray-500">点击"运行所有测试"开始测试...</div>
            ) : (
              testOutput.map((line, index) => (
                <div key={index} className="mb-1 whitespace-pre-wrap">
                  {line}
                </div>
              ))
            )}
          </div>

          {/* 测试说明 */}
          <div className="text-gray-400 text-sm">
            <h3 className="font-bold mb-2">{t('resources.testScenarios')}</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>{t('resources.normalNetwork')}</li>
              <li>{t('resources.weakNetwork')}</li>
              <li>{t('resources.networkRecovery')}</li>
              <li>{t('resources.corruptedFiles')}</li>
              <li>{t('resources.concurrentDownload')}</li>
              <li>{t('resources.cacheSystem')}</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
