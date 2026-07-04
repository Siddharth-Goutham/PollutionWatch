# 🌍 PollutionWatch

**PollutionWatch** is an AI-driven, hyper-local air pollution hotspot detection and mitigation platform. It synthesizes ground sensor telemetry, satellite data proxies, and citizen-uploaded photo evidence to generate actionable municipal dispatch alerts.

By leveraging a multi-agent LLM architecture, the platform moves beyond generic city-wide AQI scores to identify specific neighborhood-level pollution sources (e.g., road dust, unregulated brick kilns, local waste burning) and recommends targeted municipal interventions.

---

## ✨ Key Features

* **Intelligent Model Routing:** Utilizes OpenRouter to access Google's `gemini-2.5-flash` model, ensuring fast, cost-effective, and highly capable multi-agent reasoning.
* **Dynamic Data Fusion:** * Pulls real-time localized ground sensor data via the **OpenAQ API** (with AI-simulated fallbacks for low-coverage zones).
    * Simulates satellite thermal and aerosol indices for macro-level environmental context.
* **Citizen Vision Analysis:** Allows users to upload photos of active pollution. A multimodal Vision agent analyzes the images to detect smoke density, source types, and severity.
* **Robust Geocoding:** Unstructured location parsing using Nominatim (OpenStreetMap) to accurately pinpoint constituencies and districts.
* **Actionable Municipal Alerts:** An automated "Critique Agent" audits the generated hotspots and outputs prioritized, localized dispatch orders.

---

## 🛠️ Tech Stack

* **Backend:** Python, Flask (`app.py`)
* **Frontend:** TypeScript, Vite (`vite.config.ts`, `server.ts`)
* **AI Orchestration:** LangChain Core, OpenRouter API
* **External APIs:** OpenAQ (CPCB Air Quality Data), Nominatim (Geocoding)

---

## 🚀 Local Setup & Installation

The project utilizes a dual environment (Python for the backend LLM architecture, and Node.js/Vite for the frontend/TypeScript server). Follow these steps to run it locally.

### 1. Clone the Repository
\`\`\`bash
git clone https://github.com/yourusername/pollutionwatch.git
cd pollutionwatch
\`\`\`

### 2. Add Your API Keys in a `.env` File
You must create a `.env` file in the root directory to store your active API keys. The system requires these to orchestrate the AI agents. 

Create a file named `.env` and add the following contents:
\`\`\`text
# Required: OpenRouter key to power the LLM agents
OPENROUTER_API_KEY="your_actual_openrouter_key_here"

# Required: OpenAQ key for live sensor data
OPENAQ_API_KEY=""

### 3. Backend Setup (Python)
Activate your virtual environment and install the Python dependencies:
\`\`\`bash
# Activate the existing virtual environment
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate

# Install requirements
pip install -r requirements.txt
\`\`\`

### 4. Frontend Setup (Node.js/Vite)
Install the required node modules for the TypeScript frontend environment:
\`\`\`bash
npm install
\`\`\`

### 5. Run the Application
Start the Python backend server:
\`\`\`bash
python app.py
\`\`\`
*(In a separate terminal window, start your Vite dev server or TS server)*:
\`\`\`bash
npm run dev
# OR depending on your package.json configuration:
# npx ts-node server.ts
\`\`\`

---

## 💡 Usage Guide

1.  **Enter Location:** Input a Constituency, District, and State in the interface.
2.  **Upload Evidence (Optional):** Attach up to 3 images of localized pollution for the multimodal agent to analyze.
3.  **Run Scan:** Click "Run Multi-Agent Scan." The system will geocode the area, query OpenAQ, execute the data fusion agents, and output localized hotspots and municipal dispatch recommendations.
