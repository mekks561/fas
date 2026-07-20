import os
import torch
import numpy as np
from stable_baselines3 import PPO
from env import NPCGameEnv

def export_to_onnx(model_path: str, output_path: str):
    model = PPO.load(model_path)

    obs = np.zeros((1, 12), dtype=np.float32)
    obs_tensor = torch.tensor(obs).to(model.policy.device)

    with torch.no_grad():
        model.policy.set_training_mode(False)
        _, _, _ = model.policy(obs_tensor)

    dynamic_axes = {
        "input": {0: "batch_size"},
        "output": {0: "batch_size"}
    }

    torch.onnx.export(
        model.policy,
        obs_tensor,
        output_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes=dynamic_axes,
        verbose=False
    )

    print(f"Model exported to ONNX: {output_path}")
    print(f"Model size: {os.path.getsize(output_path) / 1024:.2f} KB")

    import onnx
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print("ONNX model validation passed!")

def test_onnx_model(onnx_path: str):
    import onnxruntime as ort

    session = ort.InferenceSession(onnx_path)

    test_obs = np.array([
        0.0, 0.0, 0.0,
        0.0, 0.0, 0.0,
        1.0,
        1,
        10.0, 0.0, 10.0,
        14.14
    ], dtype=np.float32).reshape(1, 12)

    inputs = {"input": test_obs}
    outputs = session.run(None, inputs)

    print("Test observation:", test_obs.flatten())
    print("Model output:", outputs[0])
    print("Predicted action:", np.argmax(outputs[0]))

    import time
    num_runs = 1000
    start = time.time()
    for _ in range(num_runs):
        session.run(None, inputs)
    end = time.time()
    avg_time = (end - start) / num_runs * 1000
    print(f"Average inference time: {avg_time:.2f} ms")

if __name__ == "__main__":
    model_path = "./models/npc_ai_final"
    onnx_path = "./models/npc_ai.onnx"

    if os.path.exists(model_path + ".zip"):
        export_to_onnx(model_path, onnx_path)
        test_onnx_model(onnx_path)
    else:
        print(f"Model not found at {model_path}.zip")
        print("Creating dummy model for testing...")

        env = NPCGameEnv()
        model = PPO(
            "MlpPolicy",
            env,
            verbose=0,
            policy_kwargs=dict(
                net_arch=dict(pi=[64, 64], vf=[64, 64])
            )
        )

        os.makedirs("./models", exist_ok=True)
        model.save(model_path)
        export_to_onnx(model_path, onnx_path)
        test_onnx_model(onnx_path)
        env.close()
