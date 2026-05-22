"""
Content & Design Engine
Automates asset selection, layout assembly, copy generation,
and case study production for multi-platform social media content.
"""

from .models.quality import QualityAssessor
from .models.face_detection import FaceDetector
from .models.content_understanding import ContentUnderstander
from .models.video_processing import VideoProcessor
from .pipeline import ContentEngine
from .data_types import AssetMetadata, SelectionResult
from .layout_assembler import LayoutAssembler
from .copy_generator import CopyGenerator
from .case_study_generator import generate_case_study
from .orchestrator import ContentOrchestrator
from .brand_segregator import BrandSegregator, AssetClassification
from .brand_voice import stepone_brand_voice, BrandVoice
from .brand_orchestrator import BrandOrchestrator

__all__ = [
    # ML Models
    "QualityAssessor",
    "FaceDetector",
    "ContentUnderstander",
    "VideoProcessor",
    # Core pipeline
    "ContentEngine",
    "AssetMetadata",
    "SelectionResult",
    # Layout and copy
    "LayoutAssembler",
    "CopyGenerator",
    "generate_case_study",
    "ContentOrchestrator",
    # Brand segregation (GFF 2025 challenge)
    "BrandSegregator",
    "AssetClassification",
    "BrandOrchestrator",
    # Brand voice
    "stepone_brand_voice",
    "BrandVoice",
]
