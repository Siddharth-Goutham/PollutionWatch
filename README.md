# 🌍 PollutionWatch

**PollutionWatch** is an AI-driven, hyper-local air pollution hotspot detection and mitigation platform. Built for the **Code for Communities** hackathon (CleanAir & Clear Streets track), it synthesizes ground sensor telemetry, satellite data proxies, and citizen-uploaded photo evidence to generate actionable municipal dispatch alerts.

By leveraging a multi-agent LLM architecture, the platform moves beyond generic city-wide AQI scores to identify specific neighborhood-level pollution sources (e.g., road dust, unregulated brick kilns, local waste burning) and recommends targeted municipal interventions.

---

## ✨ Key Features

* **Intelligent Model Routing:** Utilizes OpenRouter to access Google's `gemini-2.5-flash` model, ensuring fast, cost-effective, and highly capable multi-agent reasoning without hitting standard token limits.
* **Dynamic Data Fusion:** * Pulls real-time localized ground sensor data via the **OpenAQ API** (with AI-simulated fallbacks for low-coverage rural zones).
    * Simulates satellite thermal and aerosol indices for macro-level environmental context.
* **Citizen Vision Analysis:** Allows users to upload photos of active pollution. A multimodal Vision agent analyzes the images to detect smoke density, source types, and severity.
* **Robust Geocoding:** Unstructured location parsing using Nominatim (OpenStreetMap) to accurately pinpoint constituencies and districts across India.
* **Actionable Municipal Alerts:** An automated "Critique Agent" audits the generated hotspots and outputs prioritized, localized dispatch orders (e.g., deploying water mist cannons, cleanup crews, or traffic diversions).

---

## 🛠️ Tech Stack

* **Backend:** Python, Flask
* **AI Orchestration:** LangChain Core, OpenRouter API (`google/gemini-2.5-flash`)
* **External APIs:** OpenAQ (CPCB Air Quality Data), Nominatim (Geocoding)
* **Frontend:** HTML, CSS, JavaScript (Served via Flask)

---

## 🚀 Local Setup & Installation

To evaluate the PollutionWatch pipeline locally, you will need an active API key for OpenRouter to power the AI agents. An OpenAQ key is recommended but optional.

### 1. Clone the Repository
\`\`\`bash
git clone https://github.com/yourusername/pollutionwatch.git
cd pollutionwatch
\`\`\`

### 2. Configure Environment Variables
The AI pipeline requires explicit API keys to orchestrate the multi-agent system. Copy the example environment file to create your own local configuration:
\`\`\`bash
cp .env_example .env
\`\`\`

Open the newly created `.env` file and inject your credentials:
\`\`\`text
# Required: OpenRouter key to power the LLM agents
OPENROUTER_API_KEY="sk-or-v1-..."

# Optional: OpenAQ key for live sensor data (leave blank to use AI simulation)
OPENAQ_API_KEY=""

# Optional: Fallback Gemini key (Only required if OpenRouter key is omitted)
GEMINI_API_KEY=""
\`\`\`
*(Note: Never commit your updated `.env` file to version control. It is ignored via `.gitignore`.)*

### 3. Install Dependencies
Ensure you have Python 3.8+ installed, then install the required packages:
\`\`\`bash
pip install flask flask-cors requests python-dotenv langchain-core langchain-google-genai werkzeug
\`\`\`

### 4. Run the Application
Launch the Flask backend server:
\`\`\`bash
python app.py
\`\`\`
The server will start on `http://localhost:5000`. Open this URL in your web browser to access the PollutionWatch dashboard.

---

## 💡 Usage Guide

1.  **Enter Location:** Input a Constituency, District, and State (e.g., "HSR Layout", "Bengaluru", "Karnataka").
2.  **Upload Evidence (Optional):** Attach up to 3 images of localized pollution for the multimodal agent to analyze.
3.  **Run Scan:** Click "Run Multi-Agent Scan." The backend will geocode the area, query OpenAQ, run the data fusion agents, and output the localized hotspots and municipal dispatch recommendations.

---

## 📝 Hackathon Evaluation Notes
To ensure a seamless evaluation, the application features aggressive fallback mechanisms. If the OpenAQ API returns rate limits, or if a specific district lacks active CPCB ground sensors, the pipeline will automatically pivot to localized AI-simulated sensor readings based on the geocoded coordinates to demonstrate the platform's analytical capabilities.
