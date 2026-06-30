import os
from abc import ABC, abstractmethod
from typing import List
from google import genai
from google.genai import types

class BaseLLMClient(ABC):
    @abstractmethod
    async def generate_text(self, prompt: str, system_instruction: str = None) -> str:
        """
        Generates text using the LLM.
        """
        pass

    @abstractmethod
    async def generate_chat_response(self, history: List[dict], system_instruction: str = None) -> str:
        """
        Generates text response using chat history.
        """
        pass

class GeminiLLMClient(BaseLLMClient):
    def __init__(self, api_key: str = None, model_name: str = "gemini-2.5-flash"):
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        self.model_name = model_name
        # Initialize the client. Under the hood, google-genai will look for GEMINI_API_KEY
        # if api_key is None. We pass it explicitly to be safe.
        self.client = genai.Client(api_key=self.api_key)

    async def generate_text(self, prompt: str, system_instruction: str = None) -> str:
        config = None
        if system_instruction:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction
            )
        
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=config
        )
        return response.text

    async def generate_chat_response(self, history: List[dict], system_instruction: str = None) -> str:
        contents = []
        for msg in history:
            role = "user" if msg["role"] == "user" else "model"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg["content"])]
                )
            )
        
        config = None
        if system_instruction:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction
            )
            
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=config
        )
        return response.text
