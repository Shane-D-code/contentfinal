"""
Shared fixtures for all tests.
Creates synthetic images and videos so tests run without real event assets.
"""

import os
import tempfile
import numpy as np
import pytest
import cv2
from PIL import Image


@pytest.fixture(scope="session")
def sharp_image_path(tmp_path_factory):
    """A sharp, well-lit synthetic image (should pass quality floor)."""
    tmp = tmp_path_factory.mktemp("imgs")
    path = str(tmp / "sharp.jpg")
    # Checkerboard pattern — high Laplacian variance
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    for i in range(0, 480, 20):
        for j in range(0, 640, 20):
            if (i // 20 + j // 20) % 2 == 0:
                img[i:i+20, j:j+20] = [200, 200, 200]
    cv2.imwrite(path, img)
    return path


@pytest.fixture(scope="session")
def dark_image_path(tmp_path_factory):
    """A very dark image (should fail quality floor)."""
    tmp = tmp_path_factory.mktemp("imgs")
    path = str(tmp / "dark.jpg")
    img = np.full((480, 640, 3), 10, dtype=np.uint8)
    cv2.imwrite(path, img)
    return path


@pytest.fixture(scope="session")
def blurry_image_path(tmp_path_factory):
    """A blurry image."""
    tmp = tmp_path_factory.mktemp("imgs")
    path = str(tmp / "blurry.jpg")
    img = np.full((480, 640, 3), 128, dtype=np.uint8)
    img = cv2.GaussianBlur(img, (51, 51), 0)
    cv2.imwrite(path, img)
    return path


@pytest.fixture(scope="session")
def test_video_path(tmp_path_factory):
    """A short synthetic MP4 video."""
    import subprocess
    tmp = tmp_path_factory.mktemp("vids")
    path = str(tmp / "test.mp4")
    subprocess.run(
        ["ffmpeg", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25",
         "-t", "5", "-c:v", "libx264", "-pix_fmt", "yuv420p",
         path, "-y", "-loglevel", "quiet"],
        check=True,
    )
    return path
