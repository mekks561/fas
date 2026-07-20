import os
import numpy as np
from stable_baselines3 import PPO
from stable_baselines3.common.env_util import make_vec_env
from stable_baselines3.common.callbacks import EvalCallback, CheckpointCallback
from env import NPCGameEnv

def train_npc_ai():
    log_dir = "./logs/"
    model_dir = "./models/"
    os.makedirs(log_dir, exist_ok=True)
    os.makedirs(model_dir, exist_ok=True)

    env = make_vec_env(NPCGameEnv, n_envs=8)

    eval_env = NPCGameEnv()

    model = PPO(
        "MlpPolicy",
        env,
        verbose=1,
        tensorboard_log=log_dir,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        n_epochs=10,
        ent_coef=0.01,
        vf_coef=0.5,
        max_grad_norm=0.5,
        device="auto",
        policy_kwargs=dict(
            net_arch=dict(pi=[64, 64], vf=[64, 64])
        )
    )

    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path=model_dir,
        log_path=log_dir,
        eval_freq=10000,
        n_eval_episodes=10,
        deterministic=True,
        render=False
    )

    checkpoint_callback = CheckpointCallback(
        save_freq=50000,
        save_path=model_dir,
        name_prefix="npc_ai"
    )

    print("Starting training...")
    model.learn(
        total_timesteps=1000000,
        callback=[eval_callback, checkpoint_callback],
        log_interval=10
    )

    model.save(os.path.join(model_dir, "npc_ai_final"))
    print("Training complete! Model saved to", os.path.join(model_dir, "npc_ai_final"))

    env.close()

if __name__ == "__main__":
    train_npc_ai()
