"""
Copy Generator
Produces platform-specific captions from event context + asset metadata.

Priority order:
  1. Groq LLM (llama-3.3-70b-versatile) — context-aware, human-sounding
  2. Local LLM (Phi-3.5-mini) — if use_llm=True and Groq unavailable
  3. Template fallback — always works, zero dependencies

Groq is enabled automatically when GROQ_API_KEY is set in .env.
Falls back silently to templates on any API error.

Event type detection:
  award_ceremony  → "award", "handshake", "applause"
  keynote         → "keynote", "speech", "stage", "presentation"
  networking      → "networking", "handshake", "dinner"
  workshop        → "workshop", "exhibition"
  default         → generic professional event

A/B variants: generate_variants() returns {"primary": str, "variants": [str, ...]}
"""

import os
import re
import warnings
from dataclasses import dataclass, field
from typing import List, Optional, Dict

from content_engine.data_types import AssetMetadata

try:
    from api.logger import get_logger
    _log = get_logger(__name__)
except Exception:
    import logging
    _log = logging.getLogger(__name__)


# ── Event type detection ──────────────────────────────────────────────────────

_EVENT_CLUSTERS: Dict[str, List[str]] = {
    "award_ceremony": ["award", "handshake", "applause"],
    "keynote":        ["keynote", "speech", "stage", "presentation"],
    "networking":     ["networking", "handshake", "dinner"],
    "workshop":       ["workshop", "exhibition"],
}


def _detect_event_type(assets: List[AssetMetadata]) -> str:
    scores: Dict[str, float] = {k: 0.0 for k in _EVENT_CLUSTERS}
    for asset in assets:
        for concept, score in asset.relevance_scores.items():
            for event_type, keywords in _EVENT_CLUSTERS.items():
                if concept in keywords:
                    scores[event_type] += score
    best = max(scores, key=lambda k: scores[k])
    return best if scores[best] > 0 else "default"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _hashtag(text: str) -> str:
    return "#" + re.sub(r"[^a-zA-Z0-9]", "", text.title())


def _top_concepts(assets: List[AssetMetadata], n: int = 3) -> List[str]:
    freq: dict = {}
    for a in assets:
        for concept in a.scene_concepts[:3]:
            freq[concept] = freq.get(concept, 0) + 1
    return [c for c, _ in sorted(freq.items(), key=lambda x: x[1], reverse=True)[:n]]


def _total_faces(assets: List[AssetMetadata]) -> int:
    return sum(a.face_count for a in assets)


# ── Rich event context for LLM prompting ─────────────────────────────────────

@dataclass
class _EventContext:
    event_name: str
    event_description: str
    event_type: str
    detected_concepts: List[str]
    scene_labels: List[str]
    total_faces: int
    video_highlight_count: int
    top_asset_scores: List[float]
    hashtag: str


def _build_context(
    event_name: str,
    assets: List[AssetMetadata],
    event_description: str = "",
) -> _EventContext:
    concepts = _top_concepts(assets, 8)
    all_labels: List[str] = []
    for a in assets[:10]:
        all_labels.extend(a.scene_concepts[:3])
    # deduplicate preserving order
    seen: set = set()
    unique_labels = [l for l in all_labels if not (l in seen or seen.add(l))]  # type: ignore[func-returns-value]

    video_clips = 0
    for a in assets:
        if a.asset_type == "video" and a.highlight_clips:
            video_clips = len(a.highlight_clips)
            break

    return _EventContext(
        event_name=event_name,
        event_description=event_description or event_name,
        event_type=_detect_event_type(assets),
        detected_concepts=concepts,
        scene_labels=unique_labels[:10],
        total_faces=_total_faces(assets),
        video_highlight_count=video_clips,
        top_asset_scores=[round(a.final_score, 2) for a in sorted(assets, key=lambda x: x.final_score, reverse=True)[:3]],
        hashtag=_hashtag(event_name),
    )


# ── Groq client ───────────────────────────────────────────────────────────────

class _GroqGenerator:
    """
    Wraps the Groq API for ultra-fast LLM caption generation.
    Loaded once, reused across all caption calls.
    """

    def __init__(self, api_key: str, model: str, service_tier: str, temperature: float):
        from groq import Groq
        self._client = Groq(api_key=api_key)
        self._model = model
        self._service_tier = service_tier
        self._temperature = temperature
        _log.info("groq_ready", model=model, tier=service_tier)

    def complete(self, prompt: str, max_tokens: int = 400) -> str:
        response = self._client.chat.completions.create(
            model=self._model,
            messages=[{"role": "user", "content": prompt}],
            temperature=self._temperature,
            max_tokens=max_tokens,
            service_tier=self._service_tier,
        )
        return response.choices[0].message.content.strip()

    # ── Platform prompts ──────────────────────────────────────────────────────

    def linkedin(self, ctx: _EventContext) -> str:
        concepts_str = ", ".join(ctx.detected_concepts[:5]) if ctx.detected_concepts else "networking and keynotes"
        scenes_str   = ", ".join(ctx.scene_labels[:4]) if ctx.scene_labels else "the main stage"
        faces_line   = (
            f"Around {ctx.total_faces} people were visibly engaged in key moments."
            if ctx.total_faces > 0 else ""
        )
        event_type_hint = {
            "award_ceremony": "This was an awards ceremony — focus on recognition, achievement, and the emotional weight of the room.",
            "keynote":        "This was a keynote-heavy event — focus on ideas, insights, and what the speaker said that stuck.",
            "networking":     "This was a networking event — focus on conversations, connections, and the energy between people.",
            "workshop":       "This was a workshop — focus on learning, hands-on moments, and practical takeaways.",
        }.get(ctx.event_type, "This was a professional event.")

        prompt = f"""You attended {ctx.event_name} and are writing a LinkedIn post about it.

EVENT CONTEXT:
- Description: {ctx.event_description}
- {event_type_hint}
- What the AI detected in photos: {scenes_str}
- Key themes observed: {concepts_str}
- {faces_line}

REQUIREMENTS:
- Write in FIRST PERSON as if you genuinely attended
- Be specific — reference actual observations from the context above
- Professional tone, NO emojis in the body text
- NO "thrilled to announce", NO "excited to share", NO corporate filler
- Structure: opening observation → 2-3 specific insights → closing question
- End with a genuine question that invites engagement
- Max 220 words
- Include {ctx.hashtag} and 2 relevant hashtags at the end

Write the LinkedIn post (no title, no preamble, just the post):"""

        return self.complete(prompt, max_tokens=380)

    def instagram(self, ctx: _EventContext) -> str:
        concepts_str = ", ".join(ctx.detected_concepts[:3]) if ctx.detected_concepts else "the event"
        prompt = f"""You attended {ctx.event_name} and are writing an Instagram carousel caption.

EVENT CONTEXT:
- Themes detected: {concepts_str}
- Crowd: {ctx.total_faces} faces in key shots
- Event type: {ctx.event_type}

REQUIREMENTS:
- Casual, lowercase, conversational — NOT corporate
- 3-5 short punchy lines
- 2-3 emojis used naturally (not forced)
- End with a CTA: "swipe →", "save this", or "tag someone"
- Include {ctx.hashtag} and 2-3 relevant hashtags
- Max 100 words

Write the Instagram caption:"""

        return self.complete(prompt, max_tokens=180)

    def reel(self, ctx: _EventContext) -> str:
        clips_line = f"{ctx.video_highlight_count} highlight clips extracted." if ctx.video_highlight_count else ""
        prompt = f"""Write a short Instagram Reel caption for {ctx.event_name}.

Context: {ctx.event_description}. {clips_line}

Requirements:
- Very short: 15-25 words max
- Energetic, punchy
- 1-2 emojis
- End with a question or "tag someone" CTA
- Include {ctx.hashtag}

Write only the caption:"""

        return self.complete(prompt, max_tokens=80)

    def stories(self, ctx: _EventContext, num_frames: int) -> List[str]:
        """Generate sequential story captions as a narrative arc."""
        prompt = f"""Write {num_frames} Instagram Story captions for {ctx.event_name}.

These are sequential frames telling a story arc: arrival → main event → highlight → sign-off.
Event context: {ctx.event_description}
Themes: {", ".join(ctx.detected_concepts[:3]) if ctx.detected_concepts else "the event"}

Requirements:
- Each caption: 5-10 words only
- Casual, emoji-friendly
- Tell a narrative arc across the {num_frames} frames
- Number each one: "1.", "2.", etc.

Write the {num_frames} captions:"""

        raw = self.complete(prompt, max_tokens=120)
        # Parse numbered lines
        lines = []
        for line in raw.split("\n"):
            line = line.strip()
            if not line:
                continue
            # Strip leading "1." "2." etc
            cleaned = re.sub(r"^\d+[\.\)]\s*", "", line).strip()
            if cleaned:
                lines.append(cleaned)
        # Pad or trim to exact count
        fallback = _story_captions_template(ctx.event_name, num_frames)
        result = lines[:num_frames]
        while len(result) < num_frames:
            result.append(fallback[len(result)])
        return result

    def variant_linkedin(self, ctx: _EventContext) -> List[str]:
        """Generate 2 alternative LinkedIn angles."""
        tag = ctx.hashtag
        v1_prompt = f"""Write a LinkedIn post about {ctx.event_name} structured as 3 honest questions the event left you with.
Start with "Three questions {ctx.event_name} left me with:"
Each question should be thought-provoking and specific to a professional event.
End with "Still processing." 
Include {tag} #EventInsights
Max 120 words. Write only the post:"""

        v2_prompt = f"""Write a LinkedIn post about {ctx.event_name} structured as "what I expected vs what I got".
Format: "What I expected: [something generic]. What I got: [something specific and insightful]."
End with a line about the ROI of showing up in person.
Include {tag} #Leadership
Max 100 words. Write only the post:"""

        v1 = self.complete(v1_prompt, max_tokens=200)
        v2 = self.complete(v2_prompt, max_tokens=180)
        return [v1, v2]

    def variant_instagram(self, ctx: _EventContext) -> List[str]:
        """Generate 2 alternative Instagram angles."""
        tag = ctx.hashtag
        v1_prompt = f"""Write an Instagram caption for {ctx.event_name} as a "things that happened that the official recap won't mention" thread.
Use → bullet points for 3 specific moments.
End with "save this if you're going next year 📌"
Include {tag} #EventLife
Max 80 words. Write only the caption:"""

        v2_prompt = f"""Write an Instagram caption for {ctx.event_name} as a "rate this event" post.
Rate: content, networking, coffee, and one unexpected thing — each out of 10.
Funny and relatable tone.
Include {tag} #ConferenceLife
Max 60 words. Write only the caption:"""

        v1 = self.complete(v1_prompt, max_tokens=150)
        v2 = self.complete(v2_prompt, max_tokens=120)
        return [v1, v2]


# ── Template fallbacks ────────────────────────────────────────────────────────

def _linkedin_template(event_name: str, assets: List[AssetMetadata]) -> str:
    concepts   = _top_concepts(assets)
    faces      = _total_faces(assets)
    tag        = _hashtag(event_name)
    event_type = _detect_event_type(assets)

    if event_type == "award_ceremony":
        opening = f"Proud to have been part of {event_name}."
        body    = "Watching people get recognised for work that genuinely moves the needle — that's the kind of room that reminds you why the work matters."
        cta     = "Who in your network deserves more recognition right now?"
    elif event_type == "keynote":
        concept_line = f"The session on {concepts[0]} reframed how I think about the problem." if concepts else "The keynote reframed how I think about the problem."
        opening = f"Back from {event_name}."
        body    = f"{concept_line} Not the polished slides — the unscripted Q&A after, where the real thinking happened."
        cta     = "What's the most useful thing a speaker has said to you recently?"
    elif event_type == "networking":
        opening = f"Just wrapped {event_name}."
        body    = (f"{'Over ' + str(faces) + ' people in the room' if faces > 10 else 'A focused room'}. "
                   "The best conversations happened between sessions, not during them.")
        cta     = "What's your go-to opener at industry events?"
    else:
        concept_line = (f"The conversations around {', '.join(concepts)} were the highlight." if concepts else "The conversations were the real highlight.")
        opening = f"Just wrapped {event_name} — here's what actually stood out."
        body    = f"{concept_line} Not the polished keynote slides, but the unscripted moments between sessions where the real thinking happens."
        cta     = "What's the most useful thing you've taken from an industry event recently?"

    return f"""{opening}

{body}

Three things I'm taking back to the team:
1. The gap between what people say on stage and what they discuss in the hallway is where the opportunity lives.
2. The best questions came from the audience, not the panellists.
3. Every event has one conversation that makes the whole trip worth it. Find it early.

{cta}

{tag} #ProfessionalDevelopment #EventInsights #Leadership"""


def _instagram_carousel_template(event_name: str, assets: List[AssetMetadata]) -> str:
    concepts    = _top_concepts(assets, 2)
    tag         = _hashtag(event_name)
    concept_str = f" ({' + '.join(concepts)})" if concepts else ""
    return f"""we went to {event_name}{concept_str} so you don't have to 😅

swipe for the moments that didn't make the official recap →

save this if you're going next year 📌

{tag} #EventLife #BehindTheScenes #NetworkingIRL"""


def _instagram_reel_template(event_name: str, assets: List[AssetMetadata]) -> str:
    tag = _hashtag(event_name)
    return f"""24 hours at {event_name} 🎬

the energy? unmatched.
the learnings? still processing.
the coffee? surprisingly good.

tag someone who needs to be in the room next year 👇

{tag} #EventReel #DayInTheLife #ContentCreator"""


def _story_captions_template(event_name: str, num_slides: int) -> List[str]:
    arc = [
        f"We're at {event_name} ✨",
        "The main stage 👀",
        "Best conversation of the day 🎯",
        "See you next year 👋",
        "The room before it filled up 📸",
        "This is why we show up 🙌",
    ]
    return arc[:num_slides]


# ── Local LLM fallback (Phi-3.5-mini) ────────────────────────────────────────

class _LocalLLMGenerator:
    _MODEL_ID = "microsoft/Phi-3.5-mini-instruct"

    def __init__(self):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if torch.cuda.is_available() else torch.float32
        self.tokenizer = AutoTokenizer.from_pretrained(self._MODEL_ID)
        self.model = AutoModelForCausalLM.from_pretrained(
            self._MODEL_ID, torch_dtype=dtype, trust_remote_code=True,
        ).to(self.device)

    def generate(self, prompt: str, max_new_tokens: int = 300) -> str:
        import torch
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        with torch.no_grad():
            output = self.model.generate(
                **inputs, max_new_tokens=max_new_tokens,
                do_sample=True, temperature=0.7, top_p=0.9,
                pad_token_id=self.tokenizer.eos_token_id,
            )
        new_tokens = output[0][inputs["input_ids"].shape[1]:]
        return self.tokenizer.decode(new_tokens, skip_special_tokens=True).strip()


# ── Public API ────────────────────────────────────────────────────────────────

class CopyGenerator:
    """
    Generates platform-specific captions.

    Priority: Groq API → Local LLM (if use_llm=True) → Templates

    Args:
        use_llm:    Load Phi-3.5-mini as local LLM fallback (heavy, optional)
        groq_key:   Override GROQ_API_KEY env var (for testing)
    """

    def __init__(self, use_llm: bool = False, groq_key: Optional[str] = None):
        self._groq: Optional[_GroqGenerator] = None
        self._llm:  Optional[_LocalLLMGenerator] = None

        # Try Groq first
        key = groq_key or os.getenv("GROQ_API_KEY", "")
        if key:
            try:
                from config import settings as _cfg
                self._groq = _GroqGenerator(
                    api_key=key,
                    model=_cfg.groq_model,
                    service_tier=_cfg.groq_service_tier,
                    temperature=_cfg.groq_temperature,
                )
            except Exception as e:
                _log.warning("groq_init_failed", error=str(e))
        else:
            _log.info("groq_disabled", reason="GROQ_API_KEY not set — using templates")

        # Try local LLM if requested and Groq unavailable
        if use_llm and not self._groq:
            try:
                self._llm = _LocalLLMGenerator()
                _log.info("local_llm_loaded", model=_LocalLLMGenerator._MODEL_ID)
            except Exception as e:
                warnings.warn(f"Local LLM unavailable: {e}")

    @property
    def backend(self) -> str:
        if self._groq:  return "groq"
        if self._llm:   return "local_llm"
        return "template"

    # ── LinkedIn ──────────────────────────────────────────────────────────────

    def generate_linkedin_caption(
        self,
        event_name: str,
        assets: List[AssetMetadata],
        event_description: str = "",
    ) -> str:
        if self._groq:
            try:
                ctx = _build_context(event_name, assets, event_description)
                result = self._groq.linkedin(ctx)
                _log.info("groq_caption_done", platform="linkedin", chars=len(result))
                return result
            except Exception as e:
                _log.warning("groq_linkedin_failed", error=str(e))

        if self._llm:
            concepts = _top_concepts(assets)
            prompt = (
                f"Write a professional LinkedIn post (max 200 words) about attending '{event_name}'. "
                f"Key moments: {', '.join(concepts) or 'networking, keynotes'}. "
                f"Sound like a real attendee. End with a question. No emojis."
            )
            try:
                return self._llm.generate(prompt, max_new_tokens=280)
            except Exception:
                pass

        return _linkedin_template(event_name, assets)

    # ── Instagram carousel ────────────────────────────────────────────────────

    def generate_instagram_caption(
        self,
        event_name: str,
        assets: List[AssetMetadata],
        event_description: str = "",
    ) -> str:
        if self._groq:
            try:
                ctx = _build_context(event_name, assets, event_description)
                result = self._groq.instagram(ctx)
                _log.info("groq_caption_done", platform="instagram", chars=len(result))
                return result
            except Exception as e:
                _log.warning("groq_instagram_failed", error=str(e))

        if self._llm:
            prompt = (
                f"Write a casual Instagram caption for a carousel post about '{event_name}'. "
                f"Lowercase, conversational, 3-5 lines, ends with a CTA. Include 3 hashtags."
            )
            try:
                return self._llm.generate(prompt, max_new_tokens=150)
            except Exception:
                pass

        return _instagram_carousel_template(event_name, assets)

    # ── Instagram reel ────────────────────────────────────────────────────────

    def generate_reel_caption(
        self,
        event_name: str,
        assets: List[AssetMetadata],
        event_description: str = "",
    ) -> str:
        if self._groq:
            try:
                ctx = _build_context(event_name, assets, event_description)
                result = self._groq.reel(ctx)
                _log.info("groq_caption_done", platform="reel", chars=len(result))
                return result
            except Exception as e:
                _log.warning("groq_reel_failed", error=str(e))

        if self._llm:
            prompt = (
                f"Write a short Instagram Reel caption (max 60 words) for '{event_name}'. "
                f"Energetic, punchy, ends with a tag CTA. Include 2 hashtags."
            )
            try:
                return self._llm.generate(prompt, max_new_tokens=100)
            except Exception:
                pass

        return _instagram_reel_template(event_name, assets)

    # ── Instagram stories ─────────────────────────────────────────────────────

    def generate_story_captions(
        self,
        event_name: str,
        num_slides: int = 4,
        assets: Optional[List[AssetMetadata]] = None,
        event_description: str = "",
    ) -> List[str]:
        if self._groq and assets:
            try:
                ctx = _build_context(event_name, assets, event_description)
                result = self._groq.stories(ctx, num_slides)
                _log.info("groq_caption_done", platform="stories", frames=len(result))
                return result
            except Exception as e:
                _log.warning("groq_stories_failed", error=str(e))

        return _story_captions_template(event_name, num_slides)

    # ── A/B variants ──────────────────────────────────────────────────────────

    def generate_variants(
        self,
        platform: str,
        event_name: str,
        assets: List[AssetMetadata],
        n: int = 3,
        event_description: str = "",
    ) -> Dict[str, object]:
        """
        Generate n caption variants for a platform.
        Returns {"primary": str, "variants": [str, ...], "backend": str}
        """
        tag = _hashtag(event_name)
        concepts = _top_concepts(assets, 2)
        concept_str = f" ({', '.join(concepts)})" if concepts else ""

        if platform == "linkedin":
            primary = self.generate_linkedin_caption(event_name, assets, event_description)
            if self._groq:
                try:
                    ctx = _build_context(event_name, assets, event_description)
                    variants = self._groq.variant_linkedin(ctx)
                    return {"primary": primary, "variants": variants[:n-1], "backend": "groq"}
                except Exception as e:
                    _log.warning("groq_variants_failed", error=str(e))
            # Template variants
            v1 = (f"Three questions {event_name} left me with:\n\n"
                  f"1. Why does the hallway conversation always beat the keynote?\n"
                  f"2. What would change if we applied this to our own team?\n"
                  f"3. Who in this room is doing the most interesting work nobody's talking about?\n\n"
                  f"Still processing. More soon.\n\n{tag} #EventInsights")
            v2 = (f"The honest recap of {event_name}{concept_str}:\n\n"
                  f"What I expected: polished presentations and networking small talk.\n"
                  f"What I got: one conversation that changed how I think about the problem.\n\n"
                  f"That's the ROI of showing up in person.\n\n{tag} #Leadership")
            return {"primary": primary, "variants": [v1, v2][:n-1], "backend": self.backend}

        elif platform == "instagram":
            primary = self.generate_instagram_caption(event_name, assets, event_description)
            if self._groq:
                try:
                    ctx = _build_context(event_name, assets, event_description)
                    variants = self._groq.variant_instagram(ctx)
                    return {"primary": primary, "variants": variants[:n-1], "backend": "groq"}
                except Exception as e:
                    _log.warning("groq_variants_failed", error=str(e))
            v1 = (f"things that happened at {event_name} that the official recap won't mention 🧵\n\n"
                  f"→ the conversation that started at the coffee station and ended 2 hours later\n"
                  f"→ the speaker who went off-script and said the thing everyone was thinking\n"
                  f"→ the moment the room actually woke up\n\n"
                  f"save this if you're going next year 📌\n\n{tag} #EventLife")
            v2 = (f"rate this event experience out of 10 👇\n\n"
                  f"content: 9/10\nnetworking: 8/10\ncoffee: honestly 7/10\n"
                  f"that one conversation: 11/10\n\n{tag} #ConferenceLife #NetworkingIRL")
            return {"primary": primary, "variants": [v1, v2][:n-1], "backend": self.backend}

        else:  # reel
            primary = self.generate_reel_caption(event_name, assets, event_description)
            v1 = f"we documented everything at {event_name} 🎬 watch till the end\n\n{tag}"
            v2 = f"this is what {event_name} actually looked like 👀\n\n{tag} #BehindTheScenes"
            return {"primary": primary, "variants": [v1, v2][:n-1], "backend": self.backend}
