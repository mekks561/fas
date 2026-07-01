import React, { useRef, useEffect, useState, useCallback } from 'react';
import './TouchControlOverlay.css';

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

export const TouchControlOverlay: React.FC<TouchControlOverlayProps> = React.memo(({
  onMove,
  onFire,
  onBoost,
  onSkill1,
  onSkill2,
  onSkill3,
  onSkill4,
  skillCooldowns,
  skillMaxCooldowns,
  isVisible = true
}) => {
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const fireButtonRef = useRef<HTMLButtonElement>(null);
  const boostButtonRef = useRef<HTMLButtonElement>(null);

  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 });
  const [joystickStart, setJoystickStart] = useState({ x: 0, y: 0 });
  const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 });

  const joystickRadius = 60;

  const handleTouchStart = useCallback((e: TouchEvent, type: 'joystick' | 'fire' | 'boost' | 'skill1' | 'skill2' | 'skill3' | 'skill4') => {
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
  }, [onFire, onBoost, onSkill1, onSkill2, onSkill3, onSkill4, skillCooldowns]);

  const handleJoystickMove = useCallback((clientX: number, clientY: number) => {
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
  }, [joystickActive, joystickStart, onMove]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault();

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];

      if (joystickActive) {
        handleJoystickMove(touch.clientX, touch.clientY);
      }
    }
  }, [joystickActive, handleJoystickMove]);

  const handleTouchEnd = useCallback((e: TouchEvent, type: 'joystick' | 'fire' | 'boost') => {
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
  }, [onMove, onFire, onBoost]);

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
          if (touch.clientX >= joystickRect.left &&
              touch.clientX <= joystickRect.right &&
              touch.clientY >= joystickRect.top &&
              touch.clientY <= joystickRect.bottom) {
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
      transform: `scale(${0.9 + (1 - progress) * 0.1})`
    };
  };

  const getSkillCooldownText = (cooldown: number) => {
    if (cooldown <= 0) return '';
    return Math.ceil(cooldown).toString();
  };

  if (!isVisible) return null;

  return (
    <div className="touch-controls">
      <div className="touch-controls-left">
        <div
          ref={joystickRef}
          className={`joystick ${joystickActive ? 'active' : ''}`}
          onTouchStart={(e) => handleTouchStart(e, 'joystick')}
          onTouchMove={(e) => handleTouchMove(e)}
          onTouchEnd={(e) => handleTouchEnd(e, 'joystick')}
        >
          <div
            ref={joystickKnobRef}
            className="joystick-knob"
            style={{
              transform: `translate(${knobPosition.x}px, ${knobPosition.y}px)`
            }}
          />
        </div>
      </div>

      <div className="touch-controls-right">
        <div className="touch-controls-right-top">
          <button
            className={`skill-button skill-1 ${skillCooldowns.skill1 > 0 ? 'cooldown' : ''}`}
            style={getSkillStyle(skillCooldowns.skill1, skillMaxCooldowns.skill1)}
            onTouchStart={(e) => handleTouchStart(e, 'skill1')}
          >
            <span className="skill-icon">M</span>
            {skillCooldowns.skill1 > 0 && (
              <span className="skill-cooldown">{getSkillCooldownText(skillCooldowns.skill1)}</span>
            )}
          </button>

          <button
            className={`skill-button skill-2 ${skillCooldowns.skill2 > 0 ? 'cooldown' : ''}`}
            style={getSkillStyle(skillCooldowns.skill2, skillMaxCooldowns.skill2)}
            onTouchStart={(e) => handleTouchStart(e, 'skill2')}
          >
            <span className="skill-icon">S</span>
            {skillCooldowns.skill2 > 0 && (
              <span className="skill-cooldown">{getSkillCooldownText(skillCooldowns.skill2)}</span>
            )}
          </button>
        </div>

        <div className="touch-controls-right-middle">
          <button
            ref={fireButtonRef}
            className="action-button fire-button"
            onTouchStart={(e) => handleTouchStart(e, 'fire')}
            onTouchEnd={(e) => handleTouchEnd(e, 'fire')}
          >
            <span className="action-icon">⚡</span>
            <span className="action-label">FIRE</span>
          </button>
        </div>

        <div className="touch-controls-right-bottom">
          <button
            className={`skill-button skill-3 ${skillCooldowns.skill3 > 0 ? 'cooldown' : ''}`}
            style={getSkillStyle(skillCooldowns.skill3, skillMaxCooldowns.skill3)}
            onTouchStart={(e) => handleTouchStart(e, 'skill3')}
          >
            <span className="skill-icon">⏱</span>
            {skillCooldowns.skill3 > 0 && (
              <span className="skill-cooldown">{getSkillCooldownText(skillCooldowns.skill3)}</span>
            )}
          </button>

          <button
            className={`skill-button skill-4 ${skillCooldowns.skill4 > 0 ? 'cooldown' : ''}`}
            style={getSkillStyle(skillCooldowns.skill4, skillMaxCooldowns.skill4)}
            onTouchStart={(e) => handleTouchStart(e, 'skill4')}
          >
            <span className="skill-icon">🔥</span>
            {skillCooldowns.skill4 > 0 && (
              <span className="skill-cooldown">{getSkillCooldownText(skillCooldowns.skill4)}</span>
            )}
          </button>

          <button
            ref={boostButtonRef}
            className="action-button boost-button"
            onTouchStart={(e) => handleTouchStart(e, 'boost')}
            onTouchEnd={(e) => handleTouchEnd(e, 'boost')}
          >
            <span className="action-icon">🚀</span>
            <span className="action-label">BOOST</span>
          </button>
        </div>
      </div>
    </div>
  );
});

TouchControlOverlay.displayName = 'TouchControlOverlay';

export default TouchControlOverlay;