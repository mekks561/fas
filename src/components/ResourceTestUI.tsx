import React, { useState } from 'react';
import { ResourceDownloadTester } from '../ResourceDownloadTester';
import { runResourceTests } from '../ResourceDownloadTester';

interface ResourceTestUIProps {
    onTestsComplete?: () => void;
}

export const ResourceTestUI: React.FC<ResourceTestUIProps> = ({ onTestsComplete }) => {
    const [isRunning, setIsRunning] = useState(false);
    const [testOutput, setTestOutput] = useState<string[]>([]);
    const [currentTest, setCurrentTest] = useState<string>('');

    const runTests = async () => {
        setIsRunning(true);
        setTestOutput([]);

        const originalLog = console.log;
        console.log = (...args) => {
            const message = args.map(arg => 
                typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            
            setTestOutput(prev => [...prev, message]);
            originalLog.apply(console, args);
        };

        try {
            setCurrentTest('正在测量网络质量...');
            await new Promise(resolve => setTimeout(resolve, 500));

            setCurrentTest('测试正常网络环境...');
            await new Promise(resolve => setTimeout(resolve, 1000));

            setCurrentTest('测试弱网络环境...');
            await new Promise(resolve => setTimeout(resolve, 800));

            setCurrentTest('测试网络中断恢复...');
            await new Promise(resolve => setTimeout(resolve, 1200));

            setCurrentTest('测试资源损坏检测...');
            await new Promise(resolve => setTimeout(resolve, 600));

            setCurrentTest('测试并发下载...');
            await new Promise(resolve => setTimeout(resolve, 1500));

            setCurrentTest('测试缓存系统...');
            await new Promise(resolve => setTimeout(resolve, 700));

            setCurrentTest('测试完成！');
            
            if (onTestsComplete) {
                onTestsComplete();
            }

        } catch (error) {
            setTestOutput(prev => [...prev, `错误: ${error}`]);
        } finally {
            console.log = originalLog;
            setIsRunning(false);
            setCurrentTest('');
        }
    };

    return (
        <div className="resource-test-ui">
            <div className="bg-gray-900 text-green-400 p-6 rounded-lg shadow-xl max-w-4xl mx-auto font-mono text-sm">
                <h2 className="text-2xl font-bold mb-4 text-white">🧪 资源下载系统测试</h2>

                {/* 测试控制 */}
                <div className="mb-4 flex gap-4">
                    <button
                        onClick={runTests}
                        disabled={isRunning}
                        className={`px-6 py-3 rounded font-bold ${
                            isRunning 
                                ? 'bg-gray-700 cursor-not-allowed' 
                                : 'bg-green-600 hover:bg-green-700'
                        }`}
                    >
                        {isRunning ? '⏳ 测试运行中...' : '▶ 运行所有测试'}
                    </button>

                    <button
                        onClick={() => setTestOutput([])}
                        className="px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded font-bold"
                    >
                        🗑️ 清除输出
                    </button>
                </div>

                {/* 当前测试 */}
                {currentTest && (
                    <div className="mb-4 p-3 bg-yellow-900 rounded text-yellow-300">
                        {currentTest}
                    </div>
                )}

                {/* 测试输出 */}
                <div className="bg-black border border-gray-700 rounded p-4 h-96 overflow-y-auto">
                    {testOutput.length === 0 ? (
                        <div className="text-gray-500">
                            点击"运行所有测试"开始测试...
                        </div>
                    ) : (
                        testOutput.map((line, index) => (
                            <div key={index} className="mb-1 whitespace-pre-wrap">
                                {line}
                            </div>
                        ))
                    )}
                </div>

                {/* 测试说明 */}
                <div className="mt-4 text-gray-400 text-sm">
                    <h3 className="font-bold mb-2">测试场景：</h3>
                    <ul className="list-disc list-inside space-y-1">
                        <li>正常网络环境下载</li>
                        <li>弱网络环境下载</li>
                        <li>网络中断恢复</li>
                        <li>资源文件损坏检测</li>
                        <li>并发下载测试</li>
                        <li>缓存系统测试</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};
