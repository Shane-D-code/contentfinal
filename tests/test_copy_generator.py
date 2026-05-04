"""Tests for CopyGenerator — event type detection, variants, platform distinctness."""
import pytest
from content_engine.data_types import AssetMetadata
from content_engine.copy_generator import CopyGenerator, _detect_event_type


def _asset(concepts: dict) -> AssetMetadata:
    return AssetMetadata(
        path="test.jpg", asset_type="image",
        quality_score=0.7, aesthetic_score=0.6,
        face_count=3, face_confidences=[0.9, 0.9, 0.9],
        relevance_scores=concepts,
        scene_concepts=list(concepts.keys()),
        final_score=0.5,
    )


@pytest.fixture(scope="module")
def gen():
    return CopyGenerator(use_llm=False)


def test_event_type_award(gen):
    assets = [_asset({"award": 1.0, "applause": 1.0})]
    assert _detect_event_type(assets) == "award_ceremony"


def test_event_type_keynote(gen):
    assets = [_asset({"keynote": 1.0, "stage": 1.0})]
    assert _detect_event_type(assets) == "keynote"


def test_event_type_networking(gen):
    assets = [_asset({"networking": 1.0, "dinner": 1.0})]
    assert _detect_event_type(assets) == "networking"


def test_linkedin_caption_not_empty(gen):
    assets = [_asset({"keynote": 1.0})]
    caption = gen.generate_linkedin_caption("Test Event", assets)
    assert len(caption) > 50


def test_instagram_caption_distinct_from_linkedin(gen):
    assets = [_asset({"networking": 1.0})]
    li = gen.generate_linkedin_caption("Test Event", assets)
    ig = gen.generate_instagram_caption("Test Event", assets)
    assert li != ig


def test_story_captions_count(gen):
    caps = gen.generate_story_captions("Test Event", num_slides=4)
    assert len(caps) == 4


def test_variants_returns_primary_and_variants(gen):
    assets = [_asset({"keynote": 1.0})]
    result = gen.generate_variants("linkedin", "Test Event", assets, n=3)
    assert "primary" in result
    assert "variants" in result
    assert len(result["variants"]) == 2


def test_reel_caption_not_empty(gen):
    assets = [_asset({"stage": 1.0})]
    caption = gen.generate_reel_caption("Test Event", assets)
    assert len(caption) > 20
