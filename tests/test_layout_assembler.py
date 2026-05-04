"""Tests for LayoutAssembler — crop logic, grid selection, story burn-in."""
import pytest
from PIL import Image


@pytest.fixture(scope="module")
def assembler():
    from content_engine.layout_assembler import LayoutAssembler
    return LayoutAssembler()


def test_smart_crop_produces_correct_size(assembler, sharp_image_path):
    result = assembler.smart_crop(sharp_image_path, 1080, 1080)
    assert result.size == (1080, 1080)


def test_smart_crop_vertical(assembler, sharp_image_path):
    result = assembler.smart_crop(sharp_image_path, 1080, 1920)
    assert result.size == (1080, 1920)


def test_collage_single_image(assembler, sharp_image_path):
    collage = assembler.create_linkedin_collage([sharp_image_path])
    assert collage.size == (1080, 1080)


def test_collage_four_images(assembler, sharp_image_path):
    collage = assembler.create_linkedin_collage([sharp_image_path] * 4)
    assert collage.size == (1080, 1080)


def test_collage_six_images(assembler, sharp_image_path):
    collage = assembler.create_linkedin_collage([sharp_image_path] * 6)
    assert collage.size == (1080, 1080)


def test_carousel_produces_correct_size(assembler, sharp_image_path):
    slides = assembler.create_instagram_carousel([sharp_image_path] * 3)
    assert len(slides) == 3
    for slide in slides:
        assert slide.size == (1080, 1350)


def test_story_frame_size(assembler, sharp_image_path):
    frame = assembler.create_story_frame(sharp_image_path)
    assert frame.size == (1080, 1920)


def test_story_frame_with_caption(assembler, sharp_image_path):
    """Caption burn-in should not crash and should return correct size."""
    frame = assembler.create_story_frame(sharp_image_path, caption_text="Test caption")
    assert frame.size == (1080, 1920)


def test_collage_raises_on_empty(assembler):
    with pytest.raises(ValueError):
        assembler.create_linkedin_collage([])
