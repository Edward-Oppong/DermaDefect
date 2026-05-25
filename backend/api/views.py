from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .groq_client import generate_clinical_response
from .inference import model_ready, run_inference
from .serializers import AnalyseRequestSerializer
from .pdf_generator import build_pdf

logger = logging.getLogger(__name__)

MODEL_VERSION = "dermavision-dinov2-v1"


class HealthView(APIView):
    """GET /health — liveness + model readiness probe."""

    def get(self, request: Request) -> Response:
        return Response({
            "status":        "ok",
            "model_loaded":  model_ready(),
            "model_version": MODEL_VERSION,
        })


class AnalyseView(APIView):
    """
    POST /analyse
    Multipart fields:
      image             (required) — skin lesion image file
      include_heatmap   (bool, default False)
      include_narrative (bool, default True)
      patient_name      (str, optional)
      patient_age       (str, optional)
      patient_sex       (str, optional)
      symptoms          (str, optional)

    Returns the full structured clinical response the frontend needs directly —
    primaryFinding, confidence, urgency, urgencyText, treatmentNotes,
    recommendedAction, referralNote, conditionCode, predictions, model_version.
    """

    parser_classes = [MultiPartParser, JSONParser]

    def post(self, request: Request) -> Response:
        serializer = AnalyseRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        image_file        = serializer.validated_data["image"]
        include_heatmap   = serializer.validated_data["include_heatmap"]
        include_narrative = serializer.validated_data["include_narrative"]

        # Patient context — all optional, passed through to Groq prompt
        patient_name = request.data.get("patient_name", "").strip()
        patient_age  = request.data.get("patient_age",  "").strip()
        patient_sex  = request.data.get("patient_sex",  "").strip()
        symptoms     = request.data.get("symptoms",     "").strip()

        image_bytes = image_file.read()

        # --- Run ONNX inference ---
        try:
            inference_result = run_inference(image_bytes, include_heatmap=include_heatmap)
        except FileNotFoundError as exc:
            logger.error("Model not found: %s", exc)
            return Response(
                {"error": "Model not loaded. Please contact the administrator."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as exc:
            logger.exception("Inference error: %s", exc)
            return Response(
                {"error": "Inference failed. Check server logs."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        predictions = inference_result["predictions"]  # top-3 [{label, confidence}]
        heatmap_b64 = inference_result["heatmap_b64"]

        # --- Generate structured clinical response via Groq ---
        clinical = {}
        if include_narrative:
            try:
                clinical = generate_clinical_response(
                    predictions=predictions,
                    patient_name=patient_name,
                    patient_age=patient_age,
                    patient_sex=patient_sex,
                    symptoms=symptoms,
                )
            except Exception as exc:
                logger.warning("Clinical response generation failed: %s", exc)

        # --- Build final response ---
        # clinical already contains all frontend fields.
        # We add predictions + heatmap + model_version on top.
        response_data = {
            # Full structured fields from Groq (or fallback)
            "primaryFinding":    clinical.get("primaryFinding",    predictions[0]["label"]),
            "confidence":        clinical.get("confidence",        round(predictions[0]["confidence"] * 100)),
            "urgency":           clinical.get("urgency",           "Moderate"),
            "urgencyText":       clinical.get("urgencyText",       "Refer to clinic within 3 days."),
            "treatmentNotes":    clinical.get("treatmentNotes",    []),
            "recommendedAction": clinical.get("recommendedAction", "Refer to appropriate specialist."),
            "referralNote":      clinical.get("referralNote",      ""),
            "conditionCode":     clinical.get("conditionCode",     "ringworm"),
            "therapyRegimen":    clinical.get("therapyRegimen",    {}),
            "patientHandout":    clinical.get("patientHandout",    {}),

            # Raw model output — kept so frontend can show differential runner-ups
            "allPredictions":    predictions,
            "heatmap_b64":       heatmap_b64,
            "model_version":     MODEL_VERSION,
        }

        logger.info(
            "Analyse complete — patient: %s | finding: %s | urgency: %s",
            patient_name or "anonymous",
            response_data["primaryFinding"],
            response_data["urgency"],
        )

        return Response(response_data, status=status.HTTP_200_OK)


class GeneratePdfView(APIView):
    """
    POST /pdf
    Expects a JSON payload containing:
      - case_id
      - patient (dict with name, age, sex, symptoms, healthWorkerName)
      - clinical (dict with primaryFinding, confidence, urgency, referralNote, treatmentNotes)
      - images (dict with original_b64, heatmap_b64)
    """
    parser_classes = [JSONParser]

    def post(self, request: Request) -> Response:
        try:
            data = request.data
            case_id  = data.get("case_id", "NEW-CASE")
            patient  = data.get("patient", {})
            clinical = data.get("clinical", {})
            images   = data.get("images", {})
            
            pdf_b64 = build_pdf(case_id, patient, clinical, images)
            
            return Response({"pdf_b64": pdf_b64}, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.exception("Failed to generate PDF: %s", exc)
            return Response({"error": str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)