---
title: DermaDetect
emoji: 🔬
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# DermaDefect | Point-of-Care Clinical Skin Diagnostics


**DermaDefect** is a specialized, lightweight clinical reference interface designed for frontline health workers and primary care clinicians. It provides an immediate, privacy-focused environment to document patient skin pathologies, perform diagnostic reference mapping, and generate structured clinical referral reports at the point of care.

> **Privacy Commitment:** DermaDefect operates on a local-first architecture. All patient data, clinical notes, and diagnostic records are stored strictly within the local device's browser storage. No clinical data is ever uploaded to external servers.

---

## 🔬 Clinical Workflow Capabilities

* **Guided Assessment:** Structured 3-step workflow (Patient Info, Skin Capture, Review).
* **Diagnostic Mapping:** Matches captured lesion specimens against standardized medical pathology criteria.
* **Urgency Triage:** Automated triage level identification (High/Moderate/Low) with actionable clinical advice.
* **Referral Documentation:** One-tap generation of formatted clinical referral summaries ready for patient transfer.
* **Compliance Ready:** Built with a clean, HIPAA-compliant interface design for trust and ease of use in high-pressure clinical environments.

---

## 🛠 Project Setup

### Prerequisites
* **Node.js** (v18 or higher recommended)
* **npm** or **yarn**

### Local Installation

1.  **Clone and Install:**
    ```bash
    git clone [your-repository-url]
    cd dermadefect
    npm install
    ```

2.  **Configure Environment:**
    Create an `.env.local` file in the root directory and add your diagnostic engine credentials:
    ```bash
    GEMINI_API_KEY=your_secure_api_key_here
    ```

3.  **Launch:**
    ```bash
    npm run dev
    ```
    Access the interface via `http://localhost:3000`.

---

## 🏛 Technical Architecture

* **Framework:** Next.js (App Router)
* **Styling:** Tailwind CSS (Clinical Light Theme)
* **Interaction:** `motion/react` for intuitive workflow transitions
* **State Management:** LocalStorage-based persistence for secure, offline-capable patient records
* **Icons:** Lucide React

---

## 🛡 Security & Compliance

DermaDefect is built to support clinicians in environments where patient privacy is paramount. By leveraging local browser storage, we eliminate the risks associated with cloud-based patient data transmission, ensuring that sensitive diagnostic imagery and personal information remain in the hands of the treating clinician.

---

<div align="center">
  <p><i>Built for the next generation of primary care excellence.</i></p>
  <img width="800" src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1600&q=80" alt="DermaDefect Clinical Reference Interface" />
</div>