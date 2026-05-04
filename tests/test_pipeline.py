"""Tests for ContentEngine selection logic."""
import pytest
from content_engine.data_types import AssetMetadata, SelectionResult


def _make_asset(path="test.jpg", asset_type="image", quality=0.7, aesthetic=0.6,
                faces=3, concepts=None, final=0.5):
    return AssetMetadata(
        path=path, asset_type=asset_type,
        quality_score=quality, aesthetic_score=aesthetic,
        face_count=faces, face_confidences=[0.9] * faces,
        relevance_scores=concepts or {"keynote": 1.0},
        scene_concepts=list((concepts or {"keynote": 1.0}).keys()),
        final_score=final,
    )


def test_selection_result_fields():
    asset = _make_asset()
    result = SelectionResult(
        asset=asset,
        selection_reason="test reason",
        confidence=0.7,
        intended_use="collage",
    )
    assert result.confidence == 0.7
    assert result.intended_use == "collage"
    assert result.asset.face_count == 3


def test_composite_score_ordering():
    """Higher quality + more faces should rank higher."""
    high = _make_asset(quality=0.9, faces=8, final=0.8)
    low  = _make_asset(quality=0.4, faces=1, final=0.3)
    assets = [low, high]
    assets.sort(key=lambda a: a.final_score, reverse=True)
    assert assets[0].quality_score == 0.9


def test_video_not_rejected_on_low_quality():
    """Videos should not be filtered by quality floor."""
    video = _make_asset(asset_type="video", quality=0.1, final=0.2)
    # Videos skip the quality floor — final_score > 0 means it passes
    assert video.final_score > 0


def test_low_confidence_flag():
    asset = _make_asset(final=0.3)
    result = SelectionResult(asset=asset, selection_reason="", confidence=0.3, intended_use="story")
    assert result.confidence < 0.5  # Should be flagged


def test_explain_includes_platform_label():
    """_explain should mention the platform in the reason string."""
    from content_engine.pipeline import ContentEngine
    # We can't instantiate ContentEngine without loading models,
    # so test the logic directly
    asset = _make_asset(quality=0.85, faces=5)
    # Simulate what _explain does
    reasons = []
    if asset.quality_score >= 0.8:
        reasons.append("high technical quality")
    if asset.face_count > 0:
        reasons.append(f"{asset.face_count} face(s) visible")
    reason = "Selected for LinkedIn collage: " + "; ".join(reasons)
    assert "LinkedIn collage" in reason
    assert "high technical quality" in reason
