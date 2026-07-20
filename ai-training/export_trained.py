import os
import torch
import numpy as np
import onnx
import onnxruntime as ort
from stable_baselines3 import PPO

def export_trained_model(model_path: str, onnx_path: str):
    model = PPO.load(model_path)

    obs = np.zeros((1, 12), dtype=np.float32)
    obs_tensor = torch.tensor(obs).to(model.policy.device)

    with torch.no_grad():
        model.policy.set_training_mode(False)
        _, _, _ = model.policy(obs_tensor)

    torch.onnx.export(
        model.policy,
        obs_tensor,
        onnx_path,
        export_params=True,
        opset_version=18,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_shapes={
            "input": {0: "batch_size"},
            "output": {0: "batch_size"}
        },
        verbose=False
    )

    print(f"Model exported to: {onnx_path}")
    print(f"Model size: {os.path.getsize(onnx_path) / 1024:.2f} KB")

    onnx_model = onnx.load(onnx_path)
    onnx.checker.check_model(onnx_model)
    print("ONNX model validation passed!")

def test_onnx_model(onnx_path: str):
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

    print("\nTest Results:")
    print("Input shape:", test_obs.shape)
    print("Output shape:", outputs[0].shape)
    print("Output values:", outputs[0][0])
    print("Predicted action index:", np.argmax(outputs[0][0]))

    action_names = {0: "patrol", 1: "chase", 2: "attack", 3: "strafe", 4: "flee"}
    print("Predicted action:", action_names[np.argmax(outputs[0][0])])

    import time
    num_runs = 1000
    start = time.time()
    for _ in range(num_runs):
        session.run(None, inputs)
    end = time.time()
    avg_time = (end - start) / num_runs * 1000
    print(f"\nAverage inference time: {avg_time:.2f} ms")

if __name__ == "__main__":
    model_path = "./models/npc_ai_final"
    onnx_path = "./models/npc_ai_trained.onnx"

    if os.path.exists(model_path + ".zip"):
        export_trained_model(model_path, onnx_path)
        test_onnx_model(onnx_path)

        import shutil
        shutil.copy(onnx_path, "../public/models/npc_ai.onnx")
        print(f"\nModel copied to: ../public/models/npc_ai.onnx")
    else:
        print(f"Model not found at {model_path}.zip")
