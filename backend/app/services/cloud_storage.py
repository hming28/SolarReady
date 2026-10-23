"""
SolarReady Malaysia - Cloudflare R2 Cloud Object Storage Service
Provides persistent, permanent cloud storage for uploaded roof images and assessments.
Fully compatible with S3 protocol via boto3.
"""

import io
import logging
from pathlib import Path
from typing import Optional, List, Union
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.config import (
    R2_ENDPOINT_URL,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
)

logger = logging.getLogger(__name__)


class CloudStorageService:
    def __init__(self):
        self.bucket_name = R2_BUCKET_NAME
        self.enabled = bool(
            R2_ENDPOINT_URL and R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY and self.bucket_name
        )
        self._s3_client = None

        if self.enabled:
            try:
                self._s3_client = boto3.client(
                    "s3",
                    endpoint_url=R2_ENDPOINT_URL,
                    aws_access_key_id=R2_ACCESS_KEY_ID,
                    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
                    config=Config(signature_version="s3v4", connect_timeout=5, read_timeout=10),
                    region_name="auto",
                )
                logger.info("Cloudflare R2 storage initialized successfully.")
            except Exception as e:
                logger.warning(f"Failed to initialize Cloudflare R2 storage: {e}")
                self.enabled = False
        else:
            logger.info("Cloudflare R2 credentials not configured. Running in local-only storage mode.")

    def upload_file(
        self,
        key: str,
        data: Union[bytes, Path, str],
        content_type: str = "application/octet-stream",
    ) -> bool:
        """Upload bytes or a local file to Cloudflare R2."""
        if not self.enabled or not self._s3_client:
            return False

        try:
            extra_args = {"ContentType": content_type}
            if isinstance(data, (str, Path)):
                file_path = Path(data)
                if not file_path.exists():
                    return False
                self._s3_client.upload_file(str(file_path), self.bucket_name, key, ExtraArgs=extra_args)
            elif isinstance(data, bytes):
                self._s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=data,
                    ContentType=content_type,
                )
            logger.info(f"Successfully uploaded {key} to R2.")
            return True
        except Exception as e:
            logger.error(f"Failed to upload {key} to Cloudflare R2: {e}")
            return False

    def download_file(self, key: str, dest_path: Union[Path, str]) -> bool:
        """Download object from Cloudflare R2 to a local destination file path."""
        if not self.enabled or not self._s3_client:
            return False

        try:
            target = Path(dest_path)
            target.parent.mkdir(parents=True, exist_ok=True)
            self._s3_client.download_file(self.bucket_name, key, str(target))
            logger.info(f"Successfully downloaded {key} from R2 to {target}.")
            return True
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") == "404":
                logger.debug(f"Object {key} not found on R2.")
            else:
                logger.warning(f"R2 ClientError downloading {key}: {e}")
            return False
        except Exception as e:
            logger.warning(f"Failed to download {key} from Cloudflare R2: {e}")
            return False

    def get_bytes(self, key: str) -> Optional[bytes]:
        """Fetch raw bytes of an object from Cloudflare R2."""
        if not self.enabled or not self._s3_client:
            return None

        try:
            resp = self._s3_client.get_object(Bucket=self.bucket_name, Key=key)
            return resp["Body"].read()
        except Exception:
            return None

    def file_exists(self, key: str) -> bool:
        """Check if an object exists on Cloudflare R2."""
        if not self.enabled or not self._s3_client:
            return False

        try:
            self._s3_client.head_object(Bucket=self.bucket_name, Key=key)
            return True
        except Exception:
            return False

    def delete_file(self, key: str) -> bool:
        """Delete an object from Cloudflare R2."""
        if not self.enabled or not self._s3_client:
            return False

        try:
            self._s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            logger.info(f"Deleted {key} from R2.")
            return True
        except Exception as e:
            logger.warning(f"Failed to delete {key} from R2: {e}")
            return False

    def list_keys(self, prefix: str = "") -> List[str]:
        """List object keys under a prefix."""
        if not self.enabled or not self._s3_client:
            return []

        try:
            keys: List[str] = []
            paginator = self._s3_client.get_paginator("list_objects_v2")
            for page in paginator.paginate(Bucket=self.bucket_name, Prefix=prefix):
                for obj in page.get("Contents", []):
                    keys.append(obj["Key"])
            return keys
        except Exception as e:
            logger.warning(f"Failed to list keys from R2 prefix '{prefix}': {e}")
            return []


# Global singleton
cloud_storage = CloudStorageService()
