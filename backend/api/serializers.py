from rest_framework import serializers


class PredictionSerializer(serializers.Serializer):
    label      = serializers.CharField()
    confidence = serializers.FloatField()


class AnalyseRequestSerializer(serializers.Serializer):
    image             = serializers.ImageField()
    include_heatmap   = serializers.BooleanField(default=False)
    include_narrative = serializers.BooleanField(default=True)

    # Patient context — all optional, forwarded to Groq prompt
    # Parsed directly from request.data in views.py (not validated here
    # because they are plain strings and always safe to default to "")
    # Listed here for documentation purposes only.


class AnalyseResponseSerializer(serializers.Serializer):
    # Structured clinical fields — written by Groq
    primaryFinding    = serializers.CharField()
    confidence        = serializers.IntegerField()
    urgency           = serializers.ChoiceField(choices=["High", "Moderate", "Low"])
    urgencyText       = serializers.CharField()
    treatmentNotes    = serializers.ListField(child=serializers.CharField())
    recommendedAction = serializers.CharField()
    referralNote      = serializers.CharField()
    conditionCode     = serializers.CharField()

    # Raw model output
    allPredictions    = PredictionSerializer(many=True)
    heatmap_b64       = serializers.CharField(allow_null=True)
    model_version     = serializers.CharField()