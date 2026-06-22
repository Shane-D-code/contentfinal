"""
Brand matcher — CLIP cosine similarity (primary) + HSV histogram (fallback).
Uses sentence-transformers/clip-ViT-B-32 which is already installed in the venv.
"""

import gc
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from api.logger import get_logger
    _log = get_logger("content_engine.brand.brand_matcher")
except Exception:
    import logging
    _log = logging.getLogger("content_engine.brand.brand_matcher")

try:
    import cv2
    _CV2 = True
except ImportError:
    _CV2 = False

try:
    import torch
    from sentence_transformers import SentenceTransformer
    from PIL import Image as _PILImage
    _CLIP_AVAILABLE = True
except ImportError:
    _CLIP_AVAILABLE = False
    _log.warning("sentence-transformers not available — brand matching disabled")


@dataclass
class BrandMatch:
    brand_id: str
    brand_name: str
    confidence: float          # 0–1
    orb_score: float
    clip_score: float
    hist_score: float




@dataclass
class BrandReference:
    brand_id: str
    brand_name: str
    render_paths: List[str]
    embedding: Optional[np.ndarray] = field(default=None, repr=False)


class BrandMatcher:
    """Brand matcher using ORB + HSV histogram + CLIP.

    Weights (per requirement):
      - ORB:   0.60
      - HSV:   0.20
      - CLIP:  0.20 (only if CLIP is available)

    Brands are defined as (brand_id, brand_name, [render_paths]) tuples.

    Public contract (used by backend/frontend):
      - `segregate(asset_paths)` returns Dict[str, List[str]]
      - buckets include `unmatched`.
    """

    def __init__(
        self,
        brands: List[Tuple[str, str, List[str]]],
        similarity_threshold: float = 0.60,
        orb_nfeatures: int = 2000,
    ):
        self.threshold = similarity_threshold
        self._clip: Optional[SentenceTransformer] = None
        self.brands: List[BrandReference] = []

        # ORB precomputation
        self._orb_nfeatures = orb_nfeatures
        self._orb_matcher = None  # BFMatcher, initialised if cv2 available
        self._brand_orb = {}  # brand_id -> list of (kp, desc) for each render
        self._brand_hist = {} # brand_id -> list of precomputed hist arrays


        for brand_id, brand_name, render_paths in brands:
            valid = [p for p in render_paths if Path(p).exists()]
            if valid:
                self.brands.append(BrandReference(brand_id, brand_name, valid))
            else:
                _log.warning("no_valid_renders", brand=brand_id)

        if _CV2:
            self._orb_matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

        # Precompute ORB + HSV hist for references (fast scoring later)
        if _CV2:
            self._precompute_orb_and_hist()

        if _CLIP_AVAILABLE and self.brands:
            self._load_clip()
            self._compute_embeddings()


    # ── CLIP ──────────────────────────────────────────────────────────────────

    def _load_clip(self):
        from content_engine.utils.mps_safe import MPS_DEVICE
        self._clip = SentenceTransformer("clip-ViT-B-32", device=MPS_DEVICE)
        _log.info("clip_loaded_for_brand_matching")

    def _encode_image(self, path: str) -> Optional[np.ndarray]:
        try:
            img = _PILImage.open(path).convert("RGB")
            emb = self._clip.encode(img, convert_to_numpy=True)
            emb = emb / (np.linalg.norm(emb) + 1e-8)
            return emb
        except Exception as e:
            _log.warning("encode_failed", path=path, error=str(e))
            return None

    def _compute_embeddings(self):
        for brand in self.brands:
            embs = [self._encode_image(p) for p in brand.render_paths]
            embs = [e for e in embs if e is not None]
            if embs:
                avg = np.mean(embs, axis=0)
                brand.embedding = avg / (np.linalg.norm(avg) + 1e-8)
                _log.info("brand_embedding_ready", brand=brand.brand_id, renders=len(embs))

    # ── ORB (precomputed for references) ─────────────────────────────────────

    def _extract_orb(self, bgr: np.ndarray):
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        orb = cv2.ORB_create(nfeatures=self._orb_nfeatures)
        kp, des = orb.detectAndCompute(gray, None)
        return kp, des

    def _orb_similarity(self, query_des: Optional[np.ndarray], ref_des: Optional[np.ndarray]) -> float:
        if query_des is None or ref_des is None:
            return 0.0
        if len(query_des) < 10 or len(ref_des) < 10:
            return 0.0

        try:
            matches = self._orb_matcher.knnMatch(query_des, ref_des, k=2)
            good = 0
            for m_n in matches:
                if len(m_n) != 2:
                    continue
                m, n = m_n
                if m.distance < 0.75 * n.distance:
                    good += 1
            return min(1.0, good / 100.0)
        except Exception:
            return 0.0

    def _precompute_orb_and_hist(self):
        """Precompute ORB descriptors and HSV histograms for all brand renders."""
        if not _CV2:
            return

        for brand in self.brands:
            orb_list = []
            hist_list = []

            for render_path in brand.render_paths:
                bgr = cv2.imread(render_path)
                if bgr is None:
                    continue

                _, des = self._extract_orb(bgr)
                orb_list.append((render_path, des))

                hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
                hist = cv2.calcHist([hsv], [0, 1], None, [90, 128], [0, 180, 0, 256])
                cv2.normalize(hist, hist, 0, 1, cv2.NORM_MINMAX)
                hist_list.append(hist)

            self._brand_orb[brand.brand_id] = [d for _, d in orb_list]
            self._brand_hist[brand.brand_id] = hist_list

    # ── Histogram (precomputed for references; query computed per asset) ───

    def _hist_from_path(self, path: str):
        try:
            bgr = cv2.imread(path)
            if bgr is None:
                return None
            hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
            hist = cv2.calcHist([hsv], [0, 1], None, [90, 128], [0, 180, 0, 256])
            cv2.normalize(hist, hist, 0, 1, cv2.NORM_MINMAX)
            return hist
        except Exception:
            return None

    def _hist_similarity_from_hists(self, query_hist, ref_hist) -> float:
        if query_hist is None or ref_hist is None:
            return 0.0
        try:
            return float(max(0.0, cv2.compareHist(query_hist, ref_hist, cv2.HISTCMP_CORREL)))
        except Exception:
            return 0.0


    # ── Public API ─────────────────────────────────────────────────────────────

    def classify(self, asset_path: str) -> BrandMatch:
        """Classify a single asset. Returns BrandMatch (brand_id='unmatched' if no confident match)."""
        if not self.brands:
            return BrandMatch("unmatched", "Unmatched", 0.0, 0.0, 0.0, 0.0)


        asset_emb = self._encode_image(asset_path) if _CLIP_AVAILABLE else None

        # Precompute query ORB + hist once per asset
        query_des: Optional[np.ndarray] = None
        query_hist = None
        if _CV2:
            try:
                asset_bgr = cv2.imread(asset_path)
                if asset_bgr is not None:
                    _, query_des = self._extract_orb(asset_bgr)
            except Exception:
                query_des = None

            query_hist = self._hist_from_path(asset_path)

        best_id, best_name, best_score = "unmatched", "Unmatched", 0.0
        best_orb, best_clip, best_hist = 0.0, 0.0, 0.0

        # weights (renormalized if CLIP is unavailable)
        w_orb, w_hist, w_clip = 0.60, 0.20, 0.20
        if not (_CLIP_AVAILABLE and asset_emb is not None):
            w_orb, w_hist, w_clip = 0.75, 0.25, 0.0

        for brand in self.brands:
            orb_refs = self._brand_orb.get(brand.brand_id, [])
            hist_refs = self._brand_hist.get(brand.brand_id, [])

            # ORB score (avg over reference renders)
            orb_scores = [self._orb_similarity(query_des, ref_des) for ref_des in orb_refs]
            orb_score = float(np.mean(orb_scores)) if orb_scores else 0.0

            # Histogram score (avg over reference renders)
            hist_scores = [self._hist_similarity_from_hists(query_hist, ref_hist) for ref_hist in hist_refs]
            hist_score = float(np.mean(hist_scores)) if hist_scores else 0.0

            # CLIP score (cosine similarity -> [0,1])
            clip_score = 0.0
            if w_clip > 0.0 and brand.embedding is not None and asset_emb is not None:
                clip_raw = float(np.dot(asset_emb, brand.embedding))  # [-1,1]
                clip_score = max(0.0, (clip_raw + 1.0) / 2.0)          # [0,1]

            combined = orb_score * w_orb + hist_score * w_hist + clip_score * w_clip

            if combined > best_score:
                best_score = combined
                best_id = brand.brand_id
                best_name = brand.brand_name
                best_orb = orb_score
                best_clip = clip_score
                best_hist = hist_score




        if best_score < self.threshold:
            return BrandMatch(
                "unmatched",
                "Unmatched",
                round(best_score, 4),
                round(best_orb, 4),
                round(best_clip, 4),
                round(best_hist, 4),
            )

        return BrandMatch(
            best_id,
            best_name,
            round(best_score, 4),
            round(best_orb, 4),
            round(best_clip, 4),
            round(best_hist, 4),
        )


    def segregate(self, asset_paths: List[str]) -> Dict[str, List[str]]:
        """Segregate all assets into brand buckets. Unmatched go to 'unmatched'."""
        result: Dict[str, List[str]] = {b.brand_id: [] for b in self.brands}
        result["unmatched"] = []

        for path in asset_paths:
            match = self.classify(path)
            bucket = match.brand_id if match.brand_id in result else "unmatched"
            result[bucket].append(path)

        for brand_id, paths in result.items():
            _log.info("segregation_result", brand=brand_id, count=len(paths))

        # Clear CLIP cache after batch
        try:
            from content_engine.utils.mps_safe import empty_cache
            empty_cache()
        except Exception:
            gc.collect()

        return result
