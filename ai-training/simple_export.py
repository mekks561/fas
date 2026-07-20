import os
import torch
import torch.nn as nn
import numpy as np
import onnx
import onnxruntime as ort

class NPCAIModel(nn.Module):
    def __init__(self, input_size: int = 12, output_size: int = 5, hidden_size: int = 64):
        super().__init__()
        self.fc1 = nn.Linear(input_size, hidden_size)
        self.fc2 = nn.Linear(hidden_size, hidden_size)
        self.fc3 = nn.Linear(hidden_size, output_size)
        self.relu = nn.ReLU()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.relu(self.fc1(x))
        x = self.relu(self.fc2(x))
        x = self.fc3(x)
        return x

def create_and_export_model(output_path: str):
    model = NPCAIModel(input_size=12, output_size=5, hidden_size=64)

    torch.manual_seed(42)
    for m in model.modules():
        if isinstance(m, nn.Linear):
            nn.init.kaiming_uniform_(m.weight, nonlinearity='relu')
            nn.init.zeros_(m.bias)

    dummy_input = torch.randn(1, 12, dtype=torch.float32)

    torch.onnx.export(
        model,
        dummy_input,
        output_path,
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

    print(f"Model exported to: {output_path}")
    print(f"Model size: {os.path.getsize(output_path) / 1024:.2f} KB")

    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print("ONNX model validation passed!")

    return model

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
    os.makedirs("./models", exist_ok=True)
    onnx_path = "./models/npc_ai.onnx"

    create_and_export_model(onnx_path)
    test_onnx_model(onnx_path)

    public_dir = "../../public/models"
    os.makedirs(public_dir, exist_ok=True)

    import shutil
    shutil.copy(onnx_path, os.path.join(public_dir, "npc_ai.onnx"))
    print(f"\nModel copied to: {os.path.join(public_dir, 'npc_ai.onnx')}")
