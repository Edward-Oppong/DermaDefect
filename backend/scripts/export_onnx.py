#!/usr/bin/env python
"""
Export Jayanth2002/dinov2-base-finetuned-SkinDisease to ONNX.

Usage:
    python scripts/export_onnx.py [--output model/dermavision.onnx]

Requirements (run once, not in production image):
    pip install torch transformers onnx onnxruntime pillow
"""

import argparse
from pathlib import Path

import torch
from transformers import AutoImageProcessor, AutoModelForImageClassification
from PIL import Image
import numpy as np
import os


HF_MODEL_ID = "Jayanth2002/dinov2-base-finetuned-SkinDisease"


def export(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"Downloading {HF_MODEL_ID} …")
    processor = AutoImageProcessor.from_pretrained(HF_MODEL_ID)
    model     = AutoModelForImageClassification.from_pretrained(HF_MODEL_ID)
    model.eval()

    print("Label map:")
    for idx, label in model.config.id2label.items():
        print(f"  {idx}: {label}")
    print(f"Num classes: {len(model.config.id2label)}")

    # Dummy input — 224×224 RGB
    dummy_img    = Image.fromarray(np.zeros((224, 224, 3), dtype=np.uint8))
    inputs       = processor(images=dummy_img, return_tensors="pt")
    pixel_values = inputs["pixel_values"]   # [1, 3, 224, 224]

    print(f"\nExporting to {output_path} …")
    torch.onnx.export(
        model,
        pixel_values,
        str(output_path),
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["pixel_values"],
        output_names=["logits"],
        dynamic_axes={
            "pixel_values": {0: "batch_size"},
            "logits":       {0: "batch_size"},
        },
    )

    size_mb = os.path.getsize(output_path) / 1e6
    print(f"✓ Exported: {output_path}  ({size_mb:.1f} MB)")

    # Quick sanity check
    import onnxruntime as ort
    sess    = ort.InferenceSession(str(output_path), providers=["CPUExecutionProvider"])
    out     = sess.run(["logits"], {"pixel_values": pixel_values.numpy()})[0]
    print(f"✓ Sanity check passed — logits shape: {out.shape}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "model" / "dermavision.onnx",
    )
    args = parser.parse_args()
    export(args.output)
