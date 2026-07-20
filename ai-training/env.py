import gymnasium as gym
import numpy as np
from gymnasium import spaces
from typing import Optional

class NPCGameEnv(gym.Env):
    metadata = {"render_modes": ["human", "rgb_array"], "render_fps": 30}

    ACTION_MAP = {
        0: "patrol",
        1: "chase",
        2: "attack",
        3: "strafe",
        4: "flee"
    }

    def __init__(self, render_mode: Optional[str] = None, max_episode_steps: int = 500):
        super().__init__()

        self.max_episode_steps = max_episode_steps
        self.current_step = 0
        self.render_mode = render_mode

        self.npc_position = np.array([0.0, 0.0, 0.0], dtype=np.float32)
        self.npc_velocity = np.array([0.0, 0.0, 0.0], dtype=np.float32)
        self.npc_health = 100.0
        self.npc_max_health = 100.0
        self.npc_level = 1

        self.player_position = np.array([10.0, 0.0, 10.0], dtype=np.float32)
        self.player_velocity = np.array([0.0, 0.0, 0.0], dtype=np.float32)

        self.target_position = np.array([0.0, 0.0, 0.0], dtype=np.float32)

        self.action_space = spaces.Discrete(5)

        self.observation_space = spaces.Box(
            low=-np.inf,
            high=np.inf,
            shape=(16,),
            dtype=np.float32
        )

    def _get_observation(self) -> np.ndarray:
        relative_pos = self.player_position - self.npc_position
        distance = np.linalg.norm(relative_pos)
        health_ratio = self.npc_health / self.npc_max_health
        is_low_health = 1.0 if health_ratio < 0.3 else 0.0
        is_player_far = 1.0 if distance > 25 else 0.0
        is_player_close = 1.0 if distance < 10 else 0.0
        is_player_very_close = 1.0 if distance < 5 else 0.0

        observation = np.array([
            self.npc_position[0],
            self.npc_position[1],
            self.npc_position[2],
            self.npc_velocity[0],
            self.npc_velocity[1],
            self.npc_velocity[2],
            self.npc_health / self.npc_max_health,
            self.npc_level,
            relative_pos[0],
            relative_pos[1],
            relative_pos[2],
            distance,
            is_low_health,
            is_player_far,
            is_player_close,
            is_player_very_close
        ], dtype=np.float32)

        return observation

    def _get_info(self) -> dict:
        return {
            "npc_health": self.npc_health,
            "distance_to_player": np.linalg.norm(self.player_position - self.npc_position),
            "current_step": self.current_step
        }

    def reset(self, seed: Optional[int] = None, options: Optional[dict] = None) -> tuple:
        super().reset(seed=seed)

        self.current_step = 0
        self.npc_position = np.random.uniform(-10, 10, size=3).astype(np.float32)
        self.npc_velocity = np.array([0.0, 0.0, 0.0], dtype=np.float32)
        self.npc_health = 100.0
        self.npc_level = np.random.randint(1, 4)

        angle = np.random.uniform(0, 2 * np.pi)
        distance = np.random.uniform(5, 25)
        self.player_position = np.array([
            self.npc_position[0] + np.cos(angle) * distance,
            self.npc_position[1],
            self.npc_position[2] + np.sin(angle) * distance
        ], dtype=np.float32)

        angle = np.random.uniform(0, 2 * np.pi)
        self.target_position = np.array([
            self.npc_position[0] + np.cos(angle) * 10,
            self.npc_position[1],
            self.npc_position[2] + np.sin(angle) * 10
        ], dtype=np.float32)

        observation = self._get_observation()
        info = self._get_info()

        return observation, info

    def step(self, action: int) -> tuple:
        self.current_step += 1
        reward = 0.0
        terminated = False
        truncated = False

        action_name = self.ACTION_MAP.get(action, "patrol")

        distance_to_player = np.linalg.norm(self.player_position - self.npc_position)
        health_ratio = self.npc_health / self.npc_max_health
        is_low_health = health_ratio < 0.3
        is_player_far = distance_to_player > 25
        is_player_close = distance_to_player < 10
        is_player_very_close = distance_to_player < 5

        if action_name == "patrol":
            target_dir = self.target_position - self.npc_position
            target_dist = np.linalg.norm(target_dir)
            if target_dist > 2:
                self.npc_velocity = (target_dir / target_dist) * 1.5
            else:
                angle = np.random.uniform(0, 2 * np.pi)
                self.target_position = np.array([
                    self.npc_position[0] + np.cos(angle) * 10,
                    self.npc_position[1],
                    self.npc_position[2] + np.sin(angle) * 10
                ], dtype=np.float32)
                self.npc_velocity = np.array([0.0, 0.0, 0.0], dtype=np.float32)

            if is_player_far:
                reward += 8.0
            elif is_player_close:
                reward += 0.2
            else:
                reward += 0.5

        elif action_name == "chase":
            if is_player_far:
                reward -= 5.0
                self.npc_velocity = np.array([0.0, 0.0, 0.0], dtype=np.float32)
            elif is_player_very_close:
                reward -= 1.0
                self.npc_velocity = np.array([0.0, 0.0, 0.0], dtype=np.float32)
            else:
                chase_dir = self.player_position - self.npc_position
                chase_dist = np.linalg.norm(chase_dir)
                if chase_dist > 0:
                    self.npc_velocity = (chase_dir / chase_dist) * 3.0
                reward += 3.0

            if is_low_health:
                reward -= 8.0

        elif action_name == "attack":
            if is_player_very_close:
                damage = 10.0 + self.npc_level * 5.0
                reward += damage * 1.5
                self.npc_velocity = np.array([0.0, 0.0, 0.0], dtype=np.float32)
            else:
                reward -= 1.5

            if is_low_health:
                reward -= 2.0

        elif action_name == "strafe":
            if is_player_close:
                to_player = self.player_position - self.npc_position
                strafe_dir = np.array([-to_player[2], 0, to_player[0]], dtype=np.float32)
                strafe_dir = strafe_dir / np.linalg.norm(strafe_dir)
                self.npc_velocity = strafe_dir * 2.0
                reward += 1.0
            else:
                reward -= 0.3

        elif action_name == "flee":
            if is_low_health:
                if distance_to_player < 40:
                    flee_dir = self.npc_position - self.player_position
                    flee_dist = np.linalg.norm(flee_dir)
                    if flee_dist > 0:
                        self.npc_velocity = (flee_dir / flee_dist) * 4.0
                    reward += 8.0 + (1.0 - health_ratio) * 10.0
                else:
                    reward += 2.0
            elif distance_to_player < 5:
                flee_dir = self.npc_position - self.player_position
                flee_dist = np.linalg.norm(flee_dir)
                if flee_dist > 0:
                    self.npc_velocity = (flee_dir / flee_dist) * 4.0
                reward += 2.0
            elif is_player_far:
                reward -= 3.0
            else:
                reward -= 0.5

        self.npc_position += self.npc_velocity * 0.016
        self.npc_velocity *= 0.99

        self.npc_position = np.clip(self.npc_position, -50, 50)

        if is_player_very_close and np.random.random() < 0.15:
            self.npc_health -= 8.0
            reward -= 8.0

        if self.npc_health <= 0:
            terminated = True
            reward -= 100.0

        if self.current_step >= self.max_episode_steps:
            truncated = True

        reward += (50 - distance_to_player) * 0.005
        reward += self.npc_health * 0.02

        observation = self._get_observation()
        info = self._get_info()

        return observation, reward, terminated, truncated, info

    def render(self):
        if self.render_mode is None:
            return

        distance = np.linalg.norm(self.player_position - self.npc_position)
        print(f"Step: {self.current_step:4d} | NPC HP: {self.npc_health:6.1f} | "
              f"Distance: {distance:6.1f} | Action: {self.ACTION_MAP.get(self.last_action, 'none')}")

    def close(self):
        pass

if __name__ == "__main__":
    env = NPCGameEnv()
    observation, info = env.reset()
    print("Initial observation shape:", observation.shape)
    print("Initial observation:", observation)

    for _ in range(10):
        action = env.action_space.sample()
        observation, reward, terminated, truncated, info = env.step(action)
        print(f"Action: {action}, Reward: {reward:.2f}, Distance: {info['distance_to_player']:.2f}")
        if terminated or truncated:
            observation, info = env.reset()

    env.close()
