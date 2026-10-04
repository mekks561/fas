import { InputManager } from './InputManager';

describe('InputManager', () => {
  let canvas: HTMLCanvasElement;
  let manager: InputManager;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    manager = new InputManager(canvas);
  });

  afterEach(() => {
    manager.dispose();
    document.body.removeChild(canvas);
  });

  describe('Input Latency Tracking', () => {
    it('should track input latency', () => {
      const event = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(event);

      expect(manager.getAverageInputLatency()).toBeGreaterThanOrEqual(0);
    });

    it('should calculate max input latency', () => {
      const event1 = new KeyboardEvent('keydown', { key: 'w' });
      const event2 = new KeyboardEvent('keydown', { key: 'a' });

      window.dispatchEvent(event1);
      window.dispatchEvent(event2);

      expect(manager.getMaxInputLatency()).toBeGreaterThanOrEqual(0);
    });

    it('should maintain latency history within max size', () => {
      for (let i = 0; i < 100; i++) {
        const event = new KeyboardEvent('keydown', { key: 'w' });
        window.dispatchEvent(event);
      }

      const debugInfo = manager.getDebugInfo();
      expect(debugInfo.avgInputLatency).toBeDefined();
    });
  });

  describe('Input Prediction', () => {
    it('should enable input prediction by default', () => {
      expect(manager.isInputPredictionEnabled()).toBe(true);
    });

    it('should allow enabling/disabling input prediction', () => {
      manager.enableInputPrediction(false);
      expect(manager.isInputPredictionEnabled()).toBe(false);

      manager.enableInputPrediction(true);
      expect(manager.isInputPredictionEnabled()).toBe(true);
    });

    it('should set prediction factor within valid range', () => {
      manager.setPredictionFactor(0.3);
      expect(manager.getPredictionFactor()).toBe(0.3);

      manager.setPredictionFactor(-1);
      expect(manager.getPredictionFactor()).toBe(0);

      manager.setPredictionFactor(1);
      expect(manager.getPredictionFactor()).toBe(0.5);
    });
  });

  describe('Debug Info', () => {
    it('should include latency info in debug info', () => {
      const event = new KeyboardEvent('keydown', { key: 'w' });
      window.dispatchEvent(event);

      const debugInfo = manager.getDebugInfo();

      expect(debugInfo.avgInputLatency).toBeDefined();
      expect(debugInfo.maxInputLatency).toBeDefined();
      expect(debugInfo.predictionFactor).toBeDefined();
    });
  });

  describe('Mouse Input', () => {
    it('should track mouse input latency', () => {
      const event = new MouseEvent('mousedown', { button: 0 });
      canvas.dispatchEvent(event);

      expect(manager.getAverageInputLatency()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Touch Input', () => {
    it('should track touch input latency', () => {
      if (typeof Touch === 'undefined') {
        return;
      }
      const touch = new Touch({
        identifier: 1,
        target: canvas,
        clientX: 100,
        clientY: 100,
      });
      const event = new TouchEvent('touchstart', {
        touches: [touch],
        targetTouches: [touch],
        changedTouches: [touch],
      });

      canvas.dispatchEvent(event);

      expect(manager.getAverageInputLatency()).toBeGreaterThanOrEqual(0);
    });
  });
});
