# DermaDetect Backend API (DermaVision)

This directory contains the robust Django backend for the DermaDetect application. It handles advanced AI inference, LLM-based clinical report generation, and dynamic PDF exporting.

## Key Features

1. **AI Skin Analysis (ONNX)**: Uses a compiled ONNX Computer Vision model (`dermavision.onnx`) to detect diseases like Vasculitis, Cellulitis, and Bullous Disease with high accuracy.
2. **Multithreaded GradCAM Heatmaps**: Generates visual saliency maps (occlusion sensitivity) utilizing multi-threading to pinpoint exactly where the AI is looking on the lesion, in under a second.
3. **Groq LLM Integration**: Uses the blazing-fast Groq API (Llama3-8b-8192) to ingest the visual AI's findings and the patient's symptoms, dynamically generating a structured Clinical Evaluation, Prescribed Therapy Regimen, and Patient Handout.
4. **Professional PDF Reports**: Uses `reportlab` to instantly compile side-by-side diagnostic images, clinical notes, and a digital verified signature into a highly polished, branded PDF complete with a verifiable QR code.

## Setup Instructions

### 1. Environment Setup

It is highly recommended to use a Python virtual environment.

```bash
# Create a virtual environment
python -m venv derma

# Activate the virtual environment (Windows)
derma\Scripts\activate

# Activate the virtual environment (Mac/Linux)
source derma/bin/activate
```

### 2. Install Dependencies

Install the required Python packages:

```bash
pip install -r requirements.txt
```

### 3. Environment Variables

Create a `.env` file in the root of the `backend` folder and add your API keys. Use `.env.example` as a template:

```env
GROQ_API_KEY=your_groq_api_key_here
```

### 4. Database Migrations

Apply the standard Django migrations to set up the SQLite database:

```bash
python manage.py migrate
```

### 5. Run the Server

Start the Django development server:

```bash
python manage.py runserver
```

The API will run at `http://127.0.0.1:8000/`.

## API Endpoints

- `POST /api/analyze/`: Accepts a base64 encoded image and symptoms. Returns primary findings, confidence, multithreaded GradCAM heatmap, and the full Groq-powered clinical report.
- `POST /pdf/`: Accepts patient demographics, images, and clinical text to generate and return a base64 encoded PDF clinical assessment report.
