"""
DermaVision inference engine.
"""

from __future__ import annotations

import io
import logging
import threading
from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort
from django.conf import settings
from PIL import Image

logger = logging.getLogger(__name__)

_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
_STD  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
_SIZE = 224

LABEL_MAP: dict[int, str] = {
    0:  "Acne and Rosacea",
    1:  "Actinic Keratosis Basal Cell Carcinoma",
    2:  "Atopic Dermatitis",
    3:  "Bullous Disease",
    4:  "Cellulitis Impetigo",
    5:  "Eczema",
    6:  "Exanthems and Drug Eruptions",
    7:  "Hair Loss Alopecia",
    8:  "Herpes HPV and STDs",
    9:  "Light Diseases and Pigmentation Disorders",
    10: "Lupus and Connective Tissue Diseases",
    11: "Melanoma Skin Cancer Nevi and Moles",
    12: "Nail Fungus and Nail Disease",
    13: "Poison Ivy and Contact Dermatitis",
    14: "Psoriasis Lichen Planus",
    15: "Scabies Lyme Disease and Infestations",
    16: "Seborrheic Keratoses",
    17: "Systemic Disease",
    18: "Tinea Ringworm Candidiasis",
    19: "Urticaria Hives",
    20: "Vascular Tumors",
    21: "Vasculitis",
    22: "Warts Molluscum and Viral Infections",
}

TOP_K = 3


class _InferenceEngine:

    _lock     = threading.Lock()
    _instance = None

    def __init__(self) -> None:
        self._session: ort.InferenceSession | None = None

    def _load(self) -> None:
        model_path = Path(settings.MODEL_PATH)
        if not model_path.exists():
            raise FileNotFoundError(
                f"ONNX model not found at {model_path}. "
                "Place dermavision.onnx in the model/ directory."
            )

        logger.info("Loading DermaVision ONNX model from %s ...", model_path)
        opts = ort.SessionOptions()
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        opts.intra_op_num_threads      = 4

        providers = (
            ["CUDAExecutionProvider", "CPUExecutionProvider"]
            if "CUDAExecutionProvider" in ort.get_available_providers()
            else ["CPUExecutionProvider"]
        )

        self._session = ort.InferenceSession(str(model_path), opts, providers=providers)
        logger.info("Model ready — providers: %s", self._session.get_providers())

    @property
    def ready(self) -> bool:
        return self._session is not None

    def ensure_loaded(self) -> None:
        if not self.ready:
            with self._lock:
                if not self.ready:
                    self._load()

    def preprocess(self, image_bytes: bytes) -> tuple[np.ndarray, tuple[int, int]]:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        original_size = img.size

        w, h  = img.size
        scale = 256 / min(w, h)
        img   = img.resize((int(w * scale), int(h * scale)), Image.BICUBIC)

        w, h = img.size
        left = (w - _SIZE) // 2
        top  = (h - _SIZE) // 2
        img  = img.crop((left, top, left + _SIZE, top + _SIZE))

        arr = np.array(img, dtype=np.float32) / 255.0
        arr = (arr - _MEAN) / _STD
        arr = arr.transpose(2, 0, 1)[np.newaxis]

        return arr.astype(np.float32), original_size

    def predict(self, pixel_values: np.ndarray) -> np.ndarray:
        outputs = self._session.run(
            ["logits"],
            {"pixel_values": pixel_values},
        )
        return outputs[0]

    @staticmethod
    def top_k_predictions(logits: np.ndarray, k: int = TOP_K) -> list[dict[str, Any]]:
        logits_1d  = logits[0]
        exp_logits = np.exp(logits_1d - logits_1d.max())
        probs      = exp_logits / exp_logits.sum()

        top_indices = np.argsort(probs)[::-1][:k]
        return [
            {
                "label":      LABEL_MAP.get(int(i), f"class_{i}"),
                "confidence": round(float(probs[i]), 4),
            }
            for i in top_indices
        ]

    @staticmethod
    def attention_heatmap(
        pixel_values: np.ndarray,
        original_size: tuple[int, int],
        logits: np.ndarray,
    ) -> str | None:
        try:
            import base64
            import cv2

            import concurrent.futures

            top_class = int(np.argmax(logits[0]))
            w, h      = original_size

            # Use a coarse 4x4 grid (16 inferences) instead of the full 16x16
            # DINOv2 patch grid (256 inferences). Each coarse cell covers a
            # 56x56 pixel block. The result is bicubic-upsampled to full res.
            COARSE = 4
            cell   = _SIZE // COARSE  # 56px per cell
            importance = np.zeros((COARSE, COARSE), dtype=np.float32)

            def process_patch(row, col):
                r0, r1 = row * cell, (row + 1) * cell
                c0, c1 = col * cell, (col + 1) * cell
                masked = pixel_values.copy()
                masked[:, :, r0:r1, c0:c1] = 0.0
                masked_logits = _engine._session.run(
                    ["logits"], {"pixel_values": masked}
                )[0]
                return row, col, float(logits[0][top_class] - masked_logits[0][top_class])

            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
                futures = [
                    executor.submit(process_patch, r, c)
                    for r in range(COARSE) for c in range(COARSE)
                ]
                for future in concurrent.futures.as_completed(futures):
                    r, c, val = future.result()
                    importance[r, c] = val

            importance = np.maximum(importance, 0)
            if importance.max() > 0:
                importance /= importance.max()

            cam     = cv2.resize(importance, (w, h), interpolation=cv2.INTER_CUBIC)
            cam     = np.uint8(255 * cam)
            heatmap = cv2.applyColorMap(cam, cv2.COLORMAP_JET)

            _, buf = cv2.imencode(".png", heatmap)
            return base64.b64encode(buf.tobytes()).decode()

        except Exception as exc:
            logger.warning("Heatmap generation failed: %s", exc)
            return None


_engine = _InferenceEngine()


def run_inference(image_bytes: bytes, include_heatmap: bool = True) -> dict[str, Any]:
    _engine.ensure_loaded()

    pixel_values, original_size = _engine.preprocess(image_bytes)
    logits                      = _engine.predict(pixel_values)
    predictions                 = _engine.top_k_predictions(logits)

    heatmap_b64 = (
        _engine.attention_heatmap(pixel_values, original_size, logits)
        if include_heatmap
        else None
    )

    return {
        "predictions": predictions,
        "heatmap_b64": heatmap_b64,
    }


def model_ready() -> bool:
    return _engine.ready