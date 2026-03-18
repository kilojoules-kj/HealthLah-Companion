# debug_model.py — run this first to understand the model
from transformers import AutoConfig
import json

model_id = "MERaLiON/MERaLiON-AudioLLM-Whisper-SEA-LION"

config = AutoConfig.from_pretrained(model_id, trust_remote_code=True)

# See what auto_map is defined
print("=== Config class ===")
print(type(config))
print()

print("=== auto_map ===")
if hasattr(config, 'auto_map'):
    print(json.dumps(config.auto_map, indent=2))
else:
    print("No auto_map found!")
print()

print("=== model_type ===")
print(getattr(config, 'model_type', 'NOT SET'))
print()

print("=== architectures ===")
print(getattr(config, 'architectures', 'NOT SET'))