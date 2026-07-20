import os
import torch
import torch.nn as nn
import numpy as np
import onnx
import onnxruntime as ort
from stable_baselines3 import PPO

class SimpleNPCModel(nn.Module):
    def __init__(self, input_size: int = 16, output_size: int = 5, hidden_size: int = 64):
        super().__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, hidden_size)
        self.fc3 = nn.Linear(hidden_size, output_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = torch.tanh(self.fc1(x))
        x = torch.tanh(self.fc2(x))
        x = self.fc3(x)
        return x

def extract_and_export_model(model_path: str, onnx_path: str):
    sb3_model = PPO.load(model_path)
    
    policy_net = sb3_model.policy.mlp_extractor.policy_net
    action_net = sb3_model.policy.action_net

    simple_model = SimpleNPCModel(input_size=16, output_size=5, hidden_size=64)

    simple_model.fc1.weight.data.copy_(policy_net[0].weight.data)
    simple_model.fc1.bias.data.copy_(policy_net[0].bias.data)
    simple_model.fc2.weight.data.copy_(policy_net[2].weight.data)
    simple_model.fc2.bias.data.copy_(policy_net[2].bias.data)
    simple_model.fc3.weight.data.copy_(action_net.weight.data)
    simple_model.fc3.bias.data.copy_(action_net.bias.data)

    simple_model.eval()

    dummy_input = torch.randn(1, 16, dtype=torch.float32)

    torch.onnx.export(
        simple_model,
        dummy_input,
        onnx_path,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["input"],
        output_names=["output"],
        dynamic_axes={
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

    return simple_model

def test_onnx_model(onnx_path: str):
    session = ort.InferenceSession(onnx_path)

    test_cases = [
        {
            "name": "Player far away",
            "obs": np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1, 50.0, 0.0, 50.0, 70.71, 0.0, 1.0, 0.0, 0.0], dtype=np.float32),
            "expected_action": "patrol"
        },
        {
            "name": "Player approaching",
            "obs": np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1, 15.0, 0.0, 0.0, 15.0, 0.0, 0.0, 1.0, 0.0], dtype=np.float32),
            "expected_action": "chase"
        },
        {
            "name": "Player very close",
            "obs": np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1, 3.0, 0.0, 0.0, 3.0, 0.0, 0.0, 0.0, 1.0], dtype=np.float32),
            "expected_action": "attack"
        },
        {
            "name": "Low health, player near",
            "obs": np.array([0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2, 1, 10.0, 0.0, 0.0, 10.0, 1.0, 0.0, 1.0, 0.0], dtype=np.float32),
            "expected_action": "flee"
        }
    ]

    action_names = {0: "patrol", 1: "chase", 2: "attack", 3: "strafe", 4: "flee"}

    print("\n=== Test Results ===")
    for test_case in test_cases:
        inputs = {"input": test_case["obs"].reshape(1, 16)}
        outputs = session.run(None, inputs)
        action_idx = np.argmax(outputs[0][0])
        action_name = action_names[action_idx]
        
        print(f"\n{test_case['name']}:")
        print(f"  Input: {test_case['obs']}")
        print(f"  Output: {outputs[0][0]}")
        print(f"  Predicted: {action_name}")
        print(f"  Expected: {test_case['expected_action']}")

    import time
    num_runs = 1000
    start = time.time()
    for _ in range(num_runs):
        session.run(None, {"input": test_cases[0]["obs"].reshape(1, 16)})
    end = time.time()
    avg_time = (end - start) / num_runs * 1000
    print(f"\nAverage inference time: {avg_time:.2f} ms")

if __name__ == "__main__":
    model_path = "./models/best_model"
    onnx_path = "./models/npc_ai_trained.onnx"

    if os.path.exists(model_path + ".zip"):
        extract_and_export_model(model_path, onnx_path)
        test_onnx_model(onnx_path)

        import shutil
        shutil.copy(onnx_path, "../public/models/npc_ai.onnx")
        print(f"\nModel copied to: ../public/models/npc_ai.onnx")
    else:
        print(f"Model not found at {model_path}.zip")
