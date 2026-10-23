"""
SolarReady Malaysia - Image Processing Service
Strict validation, orientation correction, EXIF sanitization, and working copy generation.
"""

import hashlib
import io
from pathlib import Path
from typing import Tuple
from PIL import Image, ImageOps
from app.config import STORAGE_DIR
from app.services.cloud_storage import cloud_storage

MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024  # 15 MB
MAX_WORKING_DIMENSION = 2048  # Maximum pixels along longest edge


class ImageValidationError(Exception):
    pass


class ImageService:
    def __init__(self, storage_dir: Path = STORAGE_DIR):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)

    def validate_and_process(
        self, file_bytes: bytes, original_filename: str, assessment_id: str
    ) -> Tuple[str, int, int, str]:
        """
        Validates the uploaded image, sanitizes EXIF data, fixes orientation,
        and saves a working copy.

        Returns:
            (relative_image_path, width_px, height_px, sha256_hash)
        """
        # 1. Size verification
        if len(file_bytes) > MAX_FILE_SIZE_BYTES:
            raise ImageValidationError("File exceeds maximum allowed size of 15 MB.")

        if len(file_bytes) == 0:
            raise ImageValidationError("Empty file uploaded.")

        # 2. SHA-256 hash
        sha256 = hashlib.sha256(file_bytes).hexdigest()

        # 3. Decode & format verification
        try:
            image_stream = io.BytesIO(file_bytes)
            img = Image.open(image_stream)
            img.verify()  # Verifies file integrity
        except Exception as e:
            raise ImageValidationError(f"Invalid or corrupted image file: {str(e)}")

        # Reopen after verify() closes the stream
        image_stream.seek(0)
        img = Image.open(image_stream)

        if img.format not in ("JPEG", "PNG"):
            raise ImageValidationError(
                f"Unsupported image format: {img.format}. Only JPG and PNG are accepted."
            )

        # 4. EXIF Orientation correction
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass  # If no EXIF or transpose error, proceed with original orientation

        # 5. Convert mode to RGB if RGBA or palette (for JPEG saving)
        if img.mode in ("RGBA", "P"):
            rgb_img = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "RGBA":
                rgb_img.paste(img, mask=img.split()[3])
            else:
                rgb_img.paste(img)
            img = rgb_img
        elif img.mode != "RGB":
            img = img.convert("RGB")

        orig_width, orig_height = img.size

        # 6. Generate working copy if larger than MAX_WORKING_DIMENSION
        longest_edge = max(orig_width, orig_height)
        if longest_edge > MAX_WORKING_DIMENSION:
            scale_factor = MAX_WORKING_DIMENSION / longest_edge
            new_width = int(orig_width * scale_factor)
            new_height = int(orig_height * scale_factor)
            working_img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        else:
            working_img = img

        width_px, height_px = working_img.size

        # 7. Save sanitized image (EXIF data completely omitted)
        target_filename = f"{assessment_id}_working.jpg"
        target_path = self.storage_dir / target_filename

        working_img.save(
            target_path,
            format="JPEG",
            quality=92,
            optimize=True,
            # EXIF is excluded by default when saving without exif parameter
        )

        # Upload working copy to Cloudflare R2 for permanent cloud persistence
        cloud_storage.upload_file(
            key=f"images/{target_filename}",
            data=target_path,
            content_type="image/jpeg",
        )

        # Also save original copy for audit trail
        orig_filename = f"{assessment_id}_orig_{Path(original_filename).name}"
        orig_path = self.storage_dir / orig_filename
        with open(orig_path, "wb") as f:
            f.write(file_bytes)

        relative_path = f"/api/assessments/{assessment_id}/image/file"
        return relative_path, width_px, height_px, sha256


image_service = ImageService()
