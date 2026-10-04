import { FeedbackSystem } from './FeedbackSystem';

describe('FeedbackSystem', () => {
  let feedbackSystem: FeedbackSystem;

  beforeEach(() => {
    feedbackSystem = new FeedbackSystem();
  });

  afterEach(() => {
    feedbackSystem.destroy();
  });

  describe('Feedback Trigger', () => {
    it('should trigger hit feedback', () => {
      feedbackSystem.hit();
      const queue = feedbackSystem.getFeedbackQueue();
      expect(queue.length).toBeGreaterThan(0);
      expect(queue[queue.length - 1].type).toBe('hit');
    });

    it('should trigger damage feedback with intensity', () => {
      feedbackSystem.damage(50);
      const queue = feedbackSystem.getFeedbackQueue();
      expect(queue.length).toBeGreaterThan(0);
      expect(queue[queue.length - 1].type).toBe('damage');
      expect(queue[queue.length - 1].intensity).toBe(0.5);
    });

    it('should trigger heal feedback', () => {
      feedbackSystem.heal(30);
      const queue = feedbackSystem.getFeedbackQueue();
      expect(queue.length).toBeGreaterThan(0);
      expect(queue[queue.length - 1].type).toBe('heal');
    });

    it('should trigger shield feedback', () => {
      feedbackSystem.shield();
      const queue = feedbackSystem.getFeedbackQueue();
      expect(queue.length).toBeGreaterThan(0);
      expect(queue[queue.length - 1].type).toBe('shield');
    });

    it('should trigger explosion feedback', () => {
      feedbackSystem.explosion();
      const queue = feedbackSystem.getFeedbackQueue();
      expect(queue.length).toBeGreaterThan(0);
      expect(queue[queue.length - 1].type).toBe('explosion');
    });

    it('should trigger boost feedback', () => {
      feedbackSystem.boost();
      const queue = feedbackSystem.getFeedbackQueue();
      expect(queue.length).toBeGreaterThan(0);
      expect(queue[queue.length - 1].type).toBe('boost');
    });

    it('should trigger levelUp feedback', () => {
      feedbackSystem.levelUp();
      const queue = feedbackSystem.getFeedbackQueue();
      expect(queue.length).toBeGreaterThan(0);
      expect(queue[queue.length - 1].type).toBe('levelUp');
    });
  });

  describe('Feedback Queue', () => {
    it('should limit queue size', () => {
      for (let i = 0; i < 30; i++) {
        feedbackSystem.hit();
      }
      const queue = feedbackSystem.getFeedbackQueue();
      expect(queue.length).toBeLessThanOrEqual(20);
    });

    it('should clear feedback queue', () => {
      feedbackSystem.hit();
      feedbackSystem.damage(50);
      feedbackSystem.clearFeedbackQueue();
      expect(feedbackSystem.getFeedbackQueue().length).toBe(0);
    });
  });

  describe('System Control', () => {
    it('should enable and disable feedback', () => {
      expect(feedbackSystem.getIsEnabled()).toBe(true);

      feedbackSystem.disable();
      expect(feedbackSystem.getIsEnabled()).toBe(false);

      feedbackSystem.enable();
      expect(feedbackSystem.getIsEnabled()).toBe(true);
    });

    it('should not trigger feedback when disabled', () => {
      feedbackSystem.disable();
      feedbackSystem.hit();
      expect(feedbackSystem.getFeedbackQueue().length).toBe(0);
    });

    it('should enable and disable vibration', () => {
      expect(feedbackSystem.isVibrationEnabled()).toBe(true);

      feedbackSystem.enableVibration(false);
      expect(feedbackSystem.isVibrationEnabled()).toBe(false);

      feedbackSystem.enableVibration(true);
      expect(feedbackSystem.isVibrationEnabled()).toBe(true);
    });
  });

  describe('Damage Intensity', () => {
    it('should cap damage intensity at 1', () => {
      feedbackSystem.damage(200);
      const queue = feedbackSystem.getFeedbackQueue();
      expect(queue[queue.length - 1].intensity).toBe(1);
    });

    it('should calculate intensity based on damage amount', () => {
      feedbackSystem.damage(25);
      const queue = feedbackSystem.getFeedbackQueue();
      expect(queue[queue.length - 1].intensity).toBe(0.25);
    });
  });

  describe('Heal Intensity', () => {
    it('should cap heal intensity at 1', () => {
      feedbackSystem.heal(150);
      const queue = feedbackSystem.getFeedbackQueue();
      expect(queue[queue.length - 1].intensity).toBe(1);
    });

    it('should calculate intensity based on heal amount', () => {
      feedbackSystem.heal(75);
      const queue = feedbackSystem.getFeedbackQueue();
      expect(queue[queue.length - 1].intensity).toBe(0.75);
    });
  });
});
