"""
Copy Generator — Item 9: Concept-driven templates
Produces platform-specific captions from event context + asset metadata.

Event type is detected from the highest-scoring concept cluster:
  award_ceremony  → "award", "handshake", "applause"
  keynote         → "keynote", "speech", "stage", "presentation"
  networking      → "networking", "handshake", "dinner"
  workshop        → "workshop", "exhibition"
  default         → generic professional event

Item 19: A/B variants — generate_variants() returns 2-3 caption options.
"""

import re
import warnings
from typing import List, Optional, Dict
from content_engine.data_types import AssetMetadata


# ── Event type detection ──────────────────────────────────────────────────────

_EVENT_CLUSTERS: Dict[str, List[str]] = {
    "award_ceremony": ["award", "handshake", "applause"],
    "keynote":        ["keynote", "speech", "stage", "presentation"],
    "networking":     ["networking", "handshake", "dinner"],
    "workshop":       ["workshop", "exhibition"],
}


def _detect_event_type(assets: List[AssetMetadata]) -> str:
    """Return the most likely event type based on detected concepts."""
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
    """Convert 'Tech Summit 2024' → '#TechSummit2024'"""
    return "#" + re.sub(r"[^a-zA-Z0-9]", "", text.title())


def _top_concepts(assets: List[AssetMetadata], n: int = 3) -> List[str]:
    """Return the n most frequently detected scene concepts across assets."""
    freq: dict = {}
    for a in assets:
        for concept in a.scene_concepts[:3]:
            freq[concept] = freq.get(concept, 0) + 1
    return [c for c, _ in sorted(freq.items(), key=lambda x: x[1], reverse=True)[:n]]


def _total_faces(assets: List[AssetMetadata]) -> int:
    return sum(a.face_count for a in assets)


# ── Template copy ─────────────────────────────────────────────────────────────

def _linkedin_template(event_name: str, assets: List[AssetMetadata]) -> str:
    concepts = _top_concepts(assets)
    faces    = _total_faces(assets)
    tag      = _hashtag(event_name)
    event_type = _detect_event_type(assets)

    # Item 9: concept-driven copy
    if event_type == "award_ceremony":
        opening = f"Proud to have been part of {event_name}."
        body = (
            "Watching people get recognised for work that genuinely moves the needle — "
            "that's the kind of room that reminds you why the work matters."
        )
        cta = "Who in your network deserves more recognition right now?"
    elif event_type == "keynote":
        concept_line = f"The session on {concepts[0]} reframed how I think about the problem." if concepts else "The keynote reframed how I think about the problem."
        opening = f"Back from {event_name}."
        body = (
            f"{concept_line} Not the polished slides — the unscripted Q&A after, "
            "where the real thinking happened."
        )
        cta = "What's the most useful thing a speaker has said to you recently?"
    elif event_type == "networking":
        opening = f"Just wrapped {event_name}."
        body = (
            f"{'Over ' + str(faces) + ' people in the room' if faces > 10 else 'A focused room'}. "
            "The best conversations happened between sessions, not during them. "
            "The coffee bar beats the premium lounge every time."
        )
        cta = "What's your go-to opener at industry events?"
    else:
        concept_line = (f"The conversations around {', '.join(concepts)} were the highlight."
                        if concepts else "The conversations were the real highlight.")
        opening = f"Just wrapped {event_name} — here's what actually stood out."
        body = (
            f"{concept_line} Not the polished keynote slides, but the unscripted moments "
            "between sessions where the real thinking happens."
        )
        cta = "What's the most useful thing you've taken from an industry event recently?"

    return f"""{opening}

{body}

Three things I'm taking back to the team:
1. The gap between what people say on stage and what they discuss in the hallway is where the opportunity lives.
2. The best questions came from the audience, not the panellists.
3. Every event has one conversation that makes the whole trip worth it. Find it early.

{cta}

{tag} #ProfessionalDevelopment #EventInsights #Leadership"""


def _instagram_carousel_template(event_name: str, assets: List[AssetMetadata]) -> str:
    concepts = _top_concepts(assets, 2)
    tag      = _hashtag(event_name)

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
    """Sequential narrative arc for story slides."""
    arc = [
        f"We're at {event_name} ✨",
        "The main stage 👀",
        "Best conversation of the day 🎯",
        "See you next year 👋",
        "The room before it filled up 📸",
        "This is why we show up 🙌",
    ]
    return arc[:num_slides]


# ── LLM copy (optional) ───────────────────────────────────────────────────────

class _LLMCopyGenerator:
    """
    Wraps a HuggingFace causal LM for richer caption generation.
    Only instantiated if use_llm=True and the model is available.
    """

    _MODEL_ID = "microsoft/Phi-3.5-mini-instruct"

    def __init__(self):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer

        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        dtype = torch.float16 if torch.cuda.is_available() else torch.float32

        self.tokenizer = AutoTokenizer.from_pretrained(self._MODEL_ID)
        self.model = AutoModelForCausalLM.from_pretrained(
            self._MODEL_ID,
            torch_dtype=dtype,
            trust_remote_code=True,
        ).to(self.device)

    def generate(self, prompt: str, max_new_tokens: int = 300) -> str:
        import torch
        inputs = self.tokenizer(prompt, return_tensors="pt").to(self.device)
        with torch.no_grad():
            output = self.model.generate(
                **inputs,
                max_new_tokens=max_new_tokens,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
                pad_token_id=self.tokenizer.eos_token_id,
            )
        # Strip the prompt from the output
        new_tokens = output[0][inputs["input_ids"].shape[1]:]
        return self.tokenizer.decode(new_tokens, skip_special_tokens=True).strip()


# ── Public API ────────────────────────────────────────────────────────────────

class CopyGenerator:
    """
    Generates platform-specific captions.

    Args:
        use_llm: If True, attempt to load Phi-3.5-mini for richer copy.
                 Falls back to templates if the model is unavailable.
    """

    def __init__(self, use_llm: bool = False):
        self._llm: Optional[_LLMCopyGenerator] = None
        if use_llm:
            try:
                self._llm = _LLMCopyGenerator()
            except Exception as e:
                warnings.warn(f"LLM unavailable, using templates: {e}")

    # ── LinkedIn ──────────────────────────────────────────────────────────────

    def generate_linkedin_caption(
        self,
        event_name: str,
        assets: List[AssetMetadata],
    ) -> str:
        """
        Professional, first-person caption with insights and a closing question.
        Distinct from Instagram — no emojis in the body, no "I'm excited to share".
        """
        if self._llm:
            concepts = _top_concepts(assets)
            prompt = (
                f"Write a professional LinkedIn post (max 200 words) about attending "
                f"'{event_name}'. Key moments observed: {', '.join(concepts) or 'networking, keynotes'}. "
                f"Sound like a real attendee. End with a question. No emojis. No 'thrilled to announce'."
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
    ) -> str:
        """
        Casual, swipe-driven caption for carousel posts.
        Visually distinct from LinkedIn — lowercase, conversational, emoji-led.
        """
        if self._llm:
            prompt = (
                f"Write a casual Instagram caption for a carousel post about '{event_name}'. "
                f"Lowercase, conversational, 3–5 lines, ends with a CTA to swipe or save. "
                f"Include 3 relevant hashtags."
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
    ) -> str:
        """Short, punchy caption for a 30–60s reel."""
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
    ) -> List[str]:
        """
        Short sequential captions for each story frame.
        Designed as a narrative arc: arrival → main event → highlight → sign-off.
        """
        return _story_captions_template(event_name, num_slides)

    # ── Item 19: A/B variants ─────────────────────────────────────────────────

    def generate_variants(
        self,
        platform: str,
        event_name: str,
        assets: List[AssetMetadata],
        n: int = 3,
    ) -> Dict[str, object]:
        """
        Generate n caption variants for a platform.

        Args:
            platform: 'linkedin' | 'instagram' | 'reel'
            n:        number of variants (2 or 3)

        Returns:
            {"primary": str, "variants": [str, str]}
        """
        tag = _hashtag(event_name)
        concepts = _top_concepts(assets, 2)
        concept_str = f" ({', '.join(concepts)})" if concepts else ""

        if platform == "linkedin":
            primary = self.generate_linkedin_caption(event_name, assets)
            v1 = (
                f"Three questions {event_name} left me with:\n\n"
                f"1. Why does the hallway conversation always beat the keynote?\n"
                f"2. What would change if we applied this to our own team?\n"
                f"3. Who in this room is doing the most interesting work nobody's talking about?\n\n"
                f"Still processing. More soon.\n\n{tag} #EventInsights"
            )
            v2 = (
                f"The honest recap of {event_name}{concept_str}:\n\n"
                f"What I expected: polished presentations and networking small talk.\n"
                f"What I got: one conversation that changed how I think about the problem.\n\n"
                f"That's the ROI of showing up in person.\n\n{tag} #Leadership"
            )
            return {"primary": primary, "variants": [v1, v2][:n-1]}

        elif platform == "instagram":
            primary = self.generate_instagram_caption(event_name, assets)
            v1 = (
                f"things that happened at {event_name} that the official recap won't mention 🧵\n\n"
                f"→ the conversation that started at the coffee station and ended 2 hours later\n"
                f"→ the speaker who went off-script and said the thing everyone was thinking\n"
                f"→ the moment the room actually woke up\n\n"
                f"save this if you're going next year 📌\n\n{tag} #EventLife"
            )
            v2 = (
                f"rate this event experience out of 10 👇\n\n"
                f"content: 9/10\nnetworking: 8/10\ncoffee: honestly 7/10\n"
                f"that one conversation: 11/10\n\n"
                f"{tag} #ConferenceLife #NetworkingIRL"
            )
            return {"primary": primary, "variants": [v1, v2][:n-1]}

        else:  # reel
            primary = self.generate_reel_caption(event_name, assets)
            v1 = f"we documented everything at {event_name} 🎬 watch till the end\n\n{tag}"
            v2 = f"this is what {event_name} actually looked like 👀\n\n{tag} #BehindTheScenes"
            return {"primary": primary, "variants": [v1, v2][:n-1]}
