import React, { useRef, useEffect, useState, useCallback } from 'react';

export interface TouchControlOverlayProps {
  onMove: (x: number, y: number) => void;
  onFire: (active: boolean) => void;
  onBoost: (active: boolean) => void;
  onSkill1: () => void;
  onSkill2: () => void;
  onSkill3: () => void;
  onSkill4: () => void;
  skillCooldowns: {
    skill1: number;
    skill2: number;
    skill3: number;
    skill4: number;
  };
  skillMaxCooldowns: {
    skill1: number;
    skill2: number;
    skill3: number;
    skill4: number;
  };
  isVisible?: boolean;
}

export const TouchControlOverlay: React.FC<TouchControlOverlayProps> = React.memo(
  ({
    onMove,
    onFire,
    onBoost,
    onSkill1,
    onSkill2,
    onSkill3,
    onSkill4,
    skillCooldowns,
    skillMaxCooldowns,
    isVisible = true,
  }) => {
    const joystickRef = useRef<HTMLDivElement>(null);
    const joystickKnobRef = useRef<HTMLDivElement>(null);
    const fireButtonRef = useRef<HTMLButtonElement>(null);
    const boostButtonRef = useRef<HTMLButtonElement>(null);

    const [joystickActive, setJoystickActive] = useState(false);
    const [joystickStart, setJoystickStart] = useState({ x: 0, y: 0 });
    const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 });

    const joystickRadius = 60;

    const handleJoystickMove = useCallback(
      (clientX: number, clientY: number) => {
        if (!joystickActive) return;

        const dx = clientX - joystickStart.x;
        const dy = clientY - joystickStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const normalizedDistance = Math.min(distance / joystickRadius, 1);
        const angle = Math.atan2(dy, dx);

        const x = Math.cos(angle) * normalizedDistance;
        const y = Math.sin(angle) * normalizedDistance;

        setKnobPosition({ x: x * joystickRadius, y: y * joystickRadius });
        onMove(x, y);
      },
      [joystickActive, joystickStart, onMove],
    );

    const handleTouchStart = useCallback(
      (
        e: React.TouchEvent<Element>,
        type: 'joystick' | 'fire' | 'boost' | 'skill1' | 'skill2' | 'skill3' | 'skill4',
      ) => {
        e.preventDefault();

        switch (type) {
          case 'joystick': {
            const touch = e.touches[0];
            const rect = joystickRef.current?.getBoundingClientRect();
            if (!rect) return;

            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            setJoystickActive(true);
            setJoystickStart({ x: centerX, y: centerY });
            handleJoystickMove(touch.clientX, touch.clientY);
            break;
          }
          case 'fire':
            onFire(true);
            break;
          case 'boost':
            onBoost(true);
            break;
          case 'skill1':
            if (skillCooldowns.skill1 <= 0) onSkill1();
            break;
          case 'skill2':
            if (skillCooldowns.skill2 <= 0) onSkill2();
            break;
          case 'skill3':
            if (skillCooldowns.skill3 <= 0) onSkill3();
            break;
          case 'skill4':
            if (skillCooldowns.skill4 <= 0) onSkill4();
            break;
        }
      },
      [onFire, onBoost, onSkill1, onSkill2, onSkill3, onSkill4, skillCooldowns, handleJoystickMove],
    );

    const handleTouchMove = useCallback(
      (e: React.TouchEvent<Element>) => {
        e.preventDefault();

        for (let i = 0; i < e.touches.length; i++) {
          const touch = e.touches[i];

          if (joystickActive) {
            handleJoystickMove(touch.clientX, touch.clientY);
          }
        }
      },
      [joystickActive, handleJoystickMove],
    );

    const handleTouchEnd = useCallback(
      (e: React.TouchEvent<Element>, type: 'joystick' | 'fire' | 'boost') => {
        e.preventDefault();

        switch (type) {
          case 'joystick':
            setJoystickActive(false);
            setKnobPosition({ x: 0, y: 0 });
            onMove(0, 0);
            break;
          case 'fire':
            onFire(false);
            break;
          case 'boost':
            onBoost(false);
            break;
        }
      },
      [onMove, onFire, onBoost],
    );

    useEffect(() => {
      const handleGlobalTouchMove = (e: TouchEvent) => {
        if (joystickActive) {
          e.preventDefault();
          for (let i = 0; i < e.touches.length; i++) {
            handleJoystickMove(e.touches[i].clientX, e.touches[i].clientY);
          }
        }
      };

      const handleGlobalTouchEnd = (e: TouchEvent) => {
        let joystickStillActive = false;
        for (let i = 0; i < e.changedTouches.length; i++) {
          const touch = e.changedTouches[i];
          const joystickRect = joystickRef.current?.getBoundingClientRect();
          if (joystickRect) {
            if (
              touch.clientX >= joystickRect.left &&
              touch.clientX <= joystickRect.right &&
              touch.clientY >= joystickRect.top &&
              touch.clientY <= joystickRect.bottom
            ) {
              joystickStillActive = false;
            }
          }
        }

        if (!joystickStillActive && joystickActive) {
          setJoystickActive(false);
          setKnobPosition({ x: 0, y: 0 });
          onMove(0, 0);
        }
      };

      if (isVisible) {
        document.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
        document.addEventListener('touchend', handleGlobalTouchEnd);
      }

      return () => {
        document.removeEventListener('touchmove', handleGlobalTouchMove);
        document.removeEventListener('touchend', handleGlobalTouchEnd);
      };
    }, [joystickActive, isVisible, handleJoystickMove, onMove]);

    const getSkillStyle = (cooldown: number, maxCooldown: number) => {
      if (cooldown <= 0) return {};
      const progress = cooldown / maxCooldown;
      return {
        opacity: 0.6,
        transform: `scale(${0.9 + (1 - progress) * 0.1})`,
      };
    };

    const getSkillCooldownText = (cooldown: number) => {
      if (cooldown <= 0) return '';
      return Math.ceil(cooldown).toString();
    };

    if (!isVisible) return null;

    return (
      <div className="fixed inset-0 pointer-events-none z-50 md:hidden">
        <div className="absolute bottom-5 left-5 pointer-events-auto">
          <div
            ref={joystickRef}
            className={`relative w-32 h-32 rounded-full border-2 bg-white/10 touch-none transition-colors ${joystickActive ? 'bg-white/20 border-white/50' : 'border-white/30'}`}
            onTouchStart={(e) => handleTouchStart(e, 'joystick')}
            onTouchMove={(e) => handleTouchMove(e)}
            onTouchEnd={(e) => handleTouchEnd(e, 'joystick')}
          >
            <div
              ref={joystickKnobRef}
              className="absolute top-1/2 left-1/2 w-[60px] h-[60px] bg-cyan-400/80 rounded-full shadow-[0_0_20px_rgba(100,200,255,0.5)] transition-transform pointer-events-none"
              style={{
                transform: `translate(${knobPosition.x}px, ${knobPosition.y}px)`,
              }}
            >
              <div className="absolute top-1/2 left-1/2 w-[30px] h-[30px] -translate-x-1/2 -translate-y-1/2 bg-white/50 rounded-full" />
            </div>
          </div>
        </div>

        <div className="absolute bottom-5 right-5 w-32 h-64 pointer-events-auto flex flex-col justify-between">
          <div className="flex justify-between">
            <button
              className={`w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center cursor-pointer relative transition-all touch-manipulation select-none bg-gradient-to-br from-orange-400/60 to-orange-700/80 ${skillCooldowns.skill1 > 0 ? 'cursor-not-allowed' : 'active:scale-90'}`}
              style={getSkillStyle(skillCooldowns.skill1, skillMaxCooldowns.skill1)}
              onTouchStart={(e) => handleTouchStart(e, 'skill1')}
            >
              <span className="text-xl text-white drop-shadow">M</span>
              {skillCooldowns.skill1 > 0 && (
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-white/90 drop-shadow">
                  {getSkillCooldownText(skillCooldowns.skill1)}
                </span>
              )}
            </button>

            <button
              className={`w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center cursor-pointer relative transition-all touch-manipulation select-none bg-gradient-to-br from-emerald-400/60 to-emerald-700/80 ${skillCooldowns.skill2 > 0 ? 'cursor-not-allowed' : 'active:scale-90'}`}
              style={getSkillStyle(skillCooldowns.skill2, skillMaxCooldowns.skill2)}
              onTouchStart={(e) => handleTouchStart(e, 'skill2')}
            >
              <span className="text-xl text-white drop-shadow">S</span>
              {skillCooldowns.skill2 > 0 && (
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-white/90 drop-shadow">
                  {getSkillCooldownText(skillCooldowns.skill2)}
                </span>
              )}
            </button>
          </div>

          <div className="flex justify-center">
            <button
              ref={fireButtonRef}
              className="w-20 h-20 rounded-full border-none outline-none flex flex-col items-center justify-center cursor-pointer transition-transform touch-manipulation select-none active:scale-95 bg-gradient-to-br from-red-400/70 to-red-700/90 shadow-[0_4px_20px_rgba(255,100,100,0.4)] active:from-red-600/90 active:to-red-800"
              onTouchStart={(e) => handleTouchStart(e, 'fire')}
              onTouchEnd={(e) => handleTouchEnd(e, 'fire')}
            >
              <span className="text-2xl leading-none">⚡</span>
              <span className="text-[10px] text-white/80 mt-0.5 font-bold uppercase">FIRE</span>
            </button>
          </div>

          <div className="flex justify-between items-center">
            <button
              className={`w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center cursor-pointer relative transition-all touch-manipulation select-none bg-gradient-to-br from-purple-400/60 to-purple-700/80 ${skillCooldowns.skill3 > 0 ? 'cursor-not-allowed' : 'active:scale-90'}`}
              style={getSkillStyle(skillCooldowns.skill3, skillMaxCooldowns.skill3)}
              onTouchStart={(e) => handleTouchStart(e, 'skill3')}
            >
              <span className="text-xl text-white drop-shadow">⏱</span>
              {skillCooldowns.skill3 > 0 && (
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-white/90 drop-shadow">
                  {getSkillCooldownText(skillCooldowns.skill3)}
                </span>
              )}
            </button>

            <button
              className={`w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center cursor-pointer relative transition-all touch-manipulation select-none bg-gradient-to-br from-yellow-400/60 to-yellow-700/80 ${skillCooldowns.skill4 > 0 ? 'cursor-not-allowed' : 'active:scale-90'}`}
              style={getSkillStyle(skillCooldowns.skill4, skillMaxCooldowns.skill4)}
              onTouchStart={(e) => handleTouchStart(e, 'skill4')}
            >
              <span className="text-xl text-white drop-shadow">🔥</span>
              {skillCooldowns.skill4 > 0 && (
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm font-bold text-white/90 drop-shadow">
                  {getSkillCooldownText(skillCooldowns.skill4)}
                </span>
              )}
            </button>

            <button
              ref={boostButtonRef}
              className="w-20 h-20 rounded-full border-none outline-none flex flex-col items-center justify-center cursor-pointer transition-transform touch-manipulation select-none active:scale-95 bg-gradient-to-br from-cyan-400/70 to-blue-700/90 shadow-[0_4px_20px_rgba(100,200,255,0.4)] active:from-cyan-600/90 active:to-blue-800"
              onTouchStart={(e) => handleTouchStart(e, 'boost')}
              onTouchEnd={(e) => handleTouchEnd(e, 'boost')}
            >
              <span className="text-2xl leading-none">🚀</span>
              <span className="text-[10px] text-white/80 mt-0.5 font-bold uppercase">BOOST</span>
            </button>
          </div>
        </div>
      </div>
    );
  },
);

TouchControlOverlay.displayName = 'TouchControlOverlay';

export default TouchControlOverlay;
