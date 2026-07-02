import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Dialogue, DialogueLine } from '../engine/StoryMissionManager';
import './DialogueSystem.css';

interface DialogueSystemProps {
  dialogue: Dialogue | null;
  onComplete: () => void;
}

const speakerNames: Record<string, string> = {
  commander: '指挥官',
  pilot: '飞行员',
  operator: '通讯员',
  scientist: '科学家',
  admiral: '上将',
  unknown: '???',
};

const speakerColors: Record<string, string> = {
  commander: '#4a9eff',
  pilot: '#4aff8a',
  operator: '#ffaa4a',
  scientist: '#bb4aff',
  admiral: '#ff4a4a',
  unknown: '#888888',
};

const emotionIcons: Record<string, string> = {
  urgent: '!!',
  determined: '>>',
  serious: '--',
  confident: '))',
  surprised: '?!',
  worried: '..',
  angry: 'XX',
  happy: ':)',
  sad: '((',
  neutral: '  ',
};

export const DialogueSystem: React.FC<DialogueSystemProps> = ({ dialogue, onComplete }) => {
  const [lineIndex, setLineIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentLine: DialogueLine | null = dialogue?.lines[lineIndex] || null;

  const startTypewriter = useCallback((text: string) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    setDisplayedText('');
    setIsTyping(true);
    let i = 0;
    typewriterRef.current = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.substring(0, i + 1));
        i++;
      } else {
        setIsTyping(false);
        if (typewriterRef.current) clearInterval(typewriterRef.current);
      }
    }, 30);
  }, []);

  useEffect(() => {
    if (currentLine) {
      startTypewriter(currentLine.text);
    }
    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, [lineIndex, currentLine, startTypewriter]);

  // 重置当对话切换时
  useEffect(() => {
    if (dialogue) {
      setLineIndex(0);
    }
  }, [dialogue]);

  const handleNext = useCallback(() => {
    if (!dialogue) return;

    // 如果正在打字，直接显示全部文字
    if (isTyping && currentLine) {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
      setDisplayedText(currentLine.text);
      setIsTyping(false);
      return;
    }

    if (lineIndex < dialogue.lines.length - 1) {
      setLineIndex((prev) => prev + 1);
    } else {
      onComplete();
    }
  }, [dialogue, isTyping, lineIndex, currentLine, onComplete]);

  // 键盘控制
  useEffect(() => {
    if (!dialogue) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dialogue, handleNext]);

  if (!dialogue || !currentLine) return null;

  const speakerName = speakerNames[currentLine.speaker] || currentLine.speaker;
  const speakerColor = speakerColors[currentLine.speaker] || '#ffffff';
  const emotionIcon = emotionIcons[currentLine.emotion] || '  ';
  const isLastLine = lineIndex === dialogue.lines.length - 1;

  return (
    <div className="dialogue-overlay" onClick={handleNext}>
      <div className="dialogue-container">
        {/* 角色头像区域 */}
        <div className="dialogue-portrait-area">
          <div className="dialogue-portrait" style={{ borderColor: speakerColor }}>
            <div className="dialogue-portrait-icon" style={{ color: speakerColor }}>
              {currentLine.speaker.charAt(0).toUpperCase()}
            </div>
            <div className="dialogue-emotion-icon">{emotionIcon}</div>
          </div>
        </div>

        {/* 对话内容区域 */}
        <div className="dialogue-content">
          <div className="dialogue-speaker-bar" style={{ color: speakerColor }}>
            <span className="dialogue-speaker-name">{speakerName}</span>
            <span className="dialogue-line-counter">
              {lineIndex + 1} / {dialogue.lines.length}
            </span>
          </div>
          <div className="dialogue-text-area">
            <p className="dialogue-text">{displayedText}</p>
            {isTyping && <span className="dialogue-cursor">_</span>}
          </div>
          <div className="dialogue-footer">
            {isLastLine ? (
              <span className="dialogue-end-hint">[点击结束]</span>
            ) : (
              <span className="dialogue-next-hint">[点击继续 ▶]</span>
            )}
          </div>
        </div>

        {/* 进度条 */}
        <div className="dialogue-progress-bar">
          <div
            className="dialogue-progress-fill"
            style={{
              width: `${((lineIndex + 1) / dialogue.lines.length) * 100}%`,
              backgroundColor: speakerColor,
            }}
          />
        </div>
      </div>
    </div>
  );
};
