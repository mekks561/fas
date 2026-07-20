import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, Progress } from './ui/shadcn';
import type { Dialogue, DialogueLine } from '../engine/StoryMissionManager';

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
    // eslint-disable-next-line @eslint-react/set-state-in-effect
    setDisplayedText('');
    // eslint-disable-next-line @eslint-react/set-state-in-effect
    setIsTyping(true);
    let i = 0;
    typewriterRef.current = setInterval(() => {
      if (i < text.length) {
        // eslint-disable-next-line @eslint-react/set-state-in-effect
        setDisplayedText(text.substring(0, i + 1));
        i++;
      } else {
        // eslint-disable-next-line @eslint-react/set-state-in-effect
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

  useEffect(() => {
    if (dialogue) {
      const timer = setTimeout(() => setLineIndex(0), 0);
      return () => clearTimeout(timer);
    }
  }, [dialogue]);

  const handleNext = useCallback(() => {
    if (!dialogue) return;

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
  const progress = ((lineIndex + 1) / dialogue.lines.length) * 100;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end justify-center pb-8 cursor-pointer z-50"
      onClick={handleNext}
    >
      <Card className="w-full max-w-2xl bg-gradient-to-b from-black/90 to-black/70 border-gray-700">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full border-4 flex items-center justify-center relative"
              style={{ borderColor: speakerColor }}
            >
              <div
                className="text-2xl font-bold"
                style={{ color: speakerColor }}
              >
                {currentLine.speaker.charAt(0).toUpperCase()}
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-black/80 rounded-full flex items-center justify-center text-xs font-bold">
                {emotionIcon}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold" style={{ color: speakerColor }}>
                  {speakerName}
                </span>
                <span className="text-gray-400 text-sm">
                  {lineIndex + 1} / {dialogue.lines.length}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="text-white text-lg leading-relaxed min-h-[60px]">
            {displayedText}
            {isTyping && <span className="animate-pulse">_</span>}
          </div>
          <div className="mt-4 text-center">
            <span className="text-gray-400 text-sm">
              {isLastLine ? '[点击结束]' : '[点击继续 ▶]'}
            </span>
          </div>
          <div className="mt-4">
            <Progress
              value={progress}
              className="h-1"
              style={{
                '--progress-color': speakerColor,
              } as React.CSSProperties}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
