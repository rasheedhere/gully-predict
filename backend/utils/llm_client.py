import os
import time
from abc import ABC, abstractmethod
from typing import List, Optional
from google import genai
from google.genai import types

async def log_llm_call(
    caller: Optional[str],
    tournament_id: Optional[str],
    prompt: str,
    system_instruction: Optional[str],
    input_tokens: Optional[int],
    output_tokens: Optional[int],
    response_time_ms: Optional[int],
    raw_request: Optional[dict],
    raw_response: Optional[dict],
    model: Optional[str] = None
):
    if not caller:
        return
    try:
        from backend.database import async_session
        from backend.models import LLMCallLog
        async with async_session() as session:
            log_entry = LLMCallLog(
                caller=caller,
                tournament_id=tournament_id,
                model=model,
                prompt=prompt,
                system_instruction=system_instruction,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                response_time_ms=response_time_ms,
                raw_request=raw_request,
                raw_response=raw_response
            )
            session.add(log_entry)
            await session.commit()
    except Exception as e:
        import logging
        logging.error(f"Failed to write LLM call log: {e}")


class BaseLLMClient(ABC):
    @abstractmethod
    async def generate_text(
        self,
        prompt: str,
        system_instruction: str = None,
        caller: Optional[str] = None,
        tournament_id: Optional[str] = None
    ) -> str:
        """
        Generates text using the LLM.
        """
        pass

    @abstractmethod
    async def generate_chat_response(
        self,
        history: List[dict],
        system_instruction: str = None,
        caller: Optional[str] = None,
        tournament_id: Optional[str] = None
    ) -> str:
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

    async def generate_text(
        self,
        prompt: str,
        system_instruction: str = None,
        caller: Optional[str] = None,
        tournament_id: Optional[str] = None
    ) -> str:
        config = None
        if system_instruction:
            config = types.GenerateContentConfig(
                system_instruction=system_instruction
            )
        
        start_time = time.perf_counter()
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=prompt,
            config=config
        )
        duration_ms = int((time.perf_counter() - start_time) * 1000)

        # Extract tokens and payload for logging
        input_tokens = None
        output_tokens = None
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            input_tokens = getattr(response.usage_metadata, 'prompt_token_count', None)
            output_tokens = getattr(response.usage_metadata, 'candidates_token_count', None)

        raw_request = {
            "model": self.model_name,
            "contents": prompt,
            "config": {
                "system_instruction": system_instruction
            } if system_instruction else None
        }

        raw_response = None
        try:
            raw_response = response.model_dump()
        except Exception:
            try:
                raw_response = {"text": response.text}
            except Exception:
                pass

        if caller:
            import asyncio
            asyncio.create_task(
                log_llm_call(
                    caller=caller,
                    tournament_id=tournament_id,
                    prompt=prompt,
                    system_instruction=system_instruction,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    response_time_ms=duration_ms,
                    raw_request=raw_request,
                    raw_response=raw_response,
                    model=self.model_name
                )
            )

        return response.text

    async def generate_chat_response(
        self,
        history: List[dict],
        system_instruction: str = None,
        caller: Optional[str] = None,
        tournament_id: Optional[str] = None
    ) -> str:
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
            
        start_time = time.perf_counter()
        response = await self.client.aio.models.generate_content(
            model=self.model_name,
            contents=contents,
            config=config
        )
        duration_ms = int((time.perf_counter() - start_time) * 1000)

        # Extract tokens and payload for logging
        input_tokens = None
        output_tokens = None
        if hasattr(response, 'usage_metadata') and response.usage_metadata:
            input_tokens = getattr(response.usage_metadata, 'prompt_token_count', None)
            output_tokens = getattr(response.usage_metadata, 'candidates_token_count', None)

        raw_request = {
            "model": self.model_name,
            "contents": [{"role": msg["role"], "content": msg["content"]} for msg in history],
            "config": {
                "system_instruction": system_instruction
            } if system_instruction else None
        }

        raw_response = None
        try:
            raw_response = response.model_dump()
        except Exception:
            try:
                raw_response = {"text": response.text}
            except Exception:
                pass

        prompt = history[-1]["content"] if history else ""

        if caller:
            import asyncio
            asyncio.create_task(
                log_llm_call(
                    caller=caller,
                    tournament_id=tournament_id,
                    prompt=prompt,
                    system_instruction=system_instruction,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    response_time_ms=duration_ms,
                    raw_request=raw_request,
                    raw_response=raw_response,
                    model=self.model_name
                )
            )

        return response.text

