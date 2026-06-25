import os
import httpx
import json
import re
import asyncio
from typing import Optional

class GeminiClient:
    def __init__(self):
        self.api_key = os.environ.get("GEMINI_API_KEY")
        self.model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

    async def generate_structured_json(self, prompt: str) -> Optional[dict]:
        if not self.api_key:
            print("ERROR: GEMINI_API_KEY not set in environment.")
            return None
        
        # Google Generative AI REST API endpoint
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt
                        }
                    ]
                }
            ],
            "tools": [
                {
                    "google_search": {}
                }
            ]
        }

        max_retries = 3
        retry_delay = 2.0

        for attempt in range(1, max_retries + 1):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    response = await client.post(url, headers=headers, json=payload)
                    
                    # If model is unavailable (503), retry
                    if response.status_code == 503:
                        print(f"Gemini API returned 503 (Attempt {attempt}/{max_retries}). Retrying in {retry_delay}s...")
                        await asyncio.sleep(retry_delay)
                        continue
                        
                    if response.status_code != 200:
                        print(f"Gemini API Error {response.status_code}: {response.text}")
                        return None
                    
                    resp_json = response.json()
                    candidates = resp_json.get("candidates", [])
                    if not candidates:
                        print("Gemini API Error: No candidates returned.")
                        return None
                    
                    parts = candidates[0].get("content", {}).get("parts", [])
                    if not parts:
                        print("Gemini API Error: No content parts returned.")
                        return None
                    
                    text_content = parts[0].get("text", "")
                    if not text_content:
                        print("Gemini API Error: Empty content/text returned.")
                        return None
                    
                    # Strip markdown json code block fences if present
                    clean_text = text_content.strip()
                    if clean_text.startswith("```"):
                        newline_idx = clean_text.find("\n")
                        if newline_idx != -1:
                            closing_idx = clean_text.rfind("```")
                            if closing_idx != -1 and closing_idx > newline_idx:
                                clean_text = clean_text[newline_idx:closing_idx].strip()
                    
                    # Find valid JSON object boundary as a fallback
                    if not (clean_text.startswith("{") and clean_text.endswith("}")):
                        match = re.search(r"(\{.*\})", clean_text, re.DOTALL)
                        if match:
                            clean_text = match.group(1)
                    
                    try:
                        return json.loads(clean_text)
                    except Exception as parse_error:
                        print(f"JSON Parse Error: {str(parse_error)}")
                        print(f"Raw Text Content from Gemini: {text_content}")
                        print(f"Cleaned Text Content: {clean_text}")
                        return None
                        
            except (httpx.RequestError, Exception) as e:
                print(f"Exception during Gemini API request (Attempt {attempt}/{max_retries}): {str(e)}")
                if attempt < max_retries:
                    await asyncio.sleep(retry_delay)
                else:
                    return None
                    
        print(f"Gemini API failed after {max_retries} attempts.")
        return None

gemini_client = GeminiClient()
