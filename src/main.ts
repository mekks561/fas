import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './components/App';

// 创建React根元素并渲染应用
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

// 使用React.createElement语法渲染应用
root.render(React.createElement(React.StrictMode, null, React.createElement(App, null)));

// 窗口大小调整
window.addEventListener('resize', () => {
  // 由react-babylonjs自动处理
});
