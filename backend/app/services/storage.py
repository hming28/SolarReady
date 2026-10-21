"""
SolarReady Malaysia - Local Storage Service
Zero external database: uses local JSON files in data/storage/
"""

import json
from pathlib import Path
from typing import List, Optional
from app.config import STORAGE_DIR, SAMPLE_ROOFS_DIR
from app.schemas import Assessment


class StorageService:
    def __init__(self, storage_dir: Path = STORAGE_DIR):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def _get_path(self, assessment_id: str) -> Path:
        return self.storage_dir / f"{assessment_id}.json"

    def save_assessment(self, assessment: Assessment) -> Assessment:
        """Save or update assessment JSON file."""
        file_path = self._get_path(assessment.id)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(assessment.model_dump(), f, indent=2, ensure_ascii=False)
        return assessment

    def get_assessment(self, assessment_id: str) -> Optional[Assessment]:
        """Fetch assessment by ID from storage, falling back to sample_roofs if it's a demo."""
        file_path = self._get_path(assessment_id)
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return Assessment(**data)

        # Check sample roofs directory
        sample_path = SAMPLE_ROOFS_DIR / f"{assessment_id}.json"
        if sample_path.exists():
            with open(sample_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return Assessment(**data)

        return None

    def list_assessments(self) -> List[Assessment]:
        """List all assessments in local storage and samples."""
        results: List[Assessment] = []
        seen_ids = set()

        for file_path in self.storage_dir.glob("*.json"):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    assessment = Assessment(**data)
                    results.append(assessment)
                    seen_ids.add(assessment.id)
            except Exception:
                continue

        for sample_path in SAMPLE_ROOFS_DIR.glob("*.json"):
            try:
                with open(sample_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    assessment = Assessment(**data)
                    if assessment.id not in seen_ids:
                        results.append(assessment)
                        seen_ids.add(assessment.id)
            except Exception:
                continue

        return results

    def delete_assessment(self, assessment_id: str) -> bool:
        """Delete assessment JSON and associated files from storage."""
        file_path = self._get_path(assessment_id)
        deleted = False
        if file_path.exists():
            file_path.unlink()
            deleted = True
        working_img = self.storage_dir / f"{assessment_id}_working.jpg"
        if working_img.exists():
            working_img.unlink()
        return deleted


storage_service = StorageService()
