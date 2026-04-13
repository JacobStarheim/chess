from __future__ import annotations

import base64
import io
from dataclasses import dataclass
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

import cv2
import numpy as np
from PIL import Image

_PREDICTOR = None


@dataclass(slots=True)
class CropRect:
    x: float
    y: float
    width: float
    height: float


def import_board(params: dict[str, Any]) -> dict[str, Any]:
    image = load_image(params)
    processed = preprocess_image(
        image=image,
        rotation_deg=float(params.get("rotationDeg") or 0),
        crop=params.get("crop"),
        perspective_corners=params.get("perspectiveCorners"),
    )

    with NamedTemporaryFile(suffix=".png", delete=False) as handle:
        Image.fromarray(cv2.cvtColor(processed, cv2.COLOR_BGR2RGB)).save(handle.name)
        board_result = predict_position(Path(handle.name))

    return board_result


def load_image(params: dict[str, Any]) -> np.ndarray:
    image_path = params.get("imagePath")
    data_url = params.get("imageDataUrl")

    if image_path:
        image = cv2.imread(str(image_path))
        if image is None:
            raise RuntimeError(f"Could not open image: {image_path}")
        return image

    if data_url:
        _, encoded = str(data_url).split(",", 1)
        raw = base64.b64decode(encoded)
        buffer = np.frombuffer(raw, dtype=np.uint8)
        image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
        if image is None:
            raise RuntimeError("Could not decode camera image.")
        return image

    raise RuntimeError("No board image was supplied.")


def preprocess_image(
    image: np.ndarray,
    rotation_deg: float,
    crop: dict[str, float] | None,
    perspective_corners: list[dict[str, float]] | None,
) -> np.ndarray:
    working = image.copy()

    if rotation_deg:
        height, width = working.shape[:2]
        matrix = cv2.getRotationMatrix2D((width / 2, height / 2), rotation_deg, 1.0)
        working = cv2.warpAffine(working, matrix, (width, height))

    if crop:
        working = apply_crop(working, CropRect(**crop))

    if perspective_corners and len(perspective_corners) == 4:
        working = apply_perspective_transform(working, perspective_corners)

    return working


def apply_crop(image: np.ndarray, crop: CropRect) -> np.ndarray:
    height, width = image.shape[:2]
    x0 = int(width * crop.x)
    y0 = int(height * crop.y)
    x1 = int(width * min(1.0, crop.x + crop.width))
    y1 = int(height * min(1.0, crop.y + crop.height))
    return image[y0:y1, x0:x1]


def apply_perspective_transform(
    image: np.ndarray, perspective_corners: list[dict[str, float]]
) -> np.ndarray:
    height, width = image.shape[:2]
    source = np.array(
        [
            [perspective_corners[0]["x"] * width, perspective_corners[0]["y"] * height],
            [perspective_corners[1]["x"] * width, perspective_corners[1]["y"] * height],
            [perspective_corners[2]["x"] * width, perspective_corners[2]["y"] * height],
            [perspective_corners[3]["x"] * width, perspective_corners[3]["y"] * height],
        ],
        dtype=np.float32,
    )
    destination = np.array(
        [
            [0, 0],
            [512, 0],
            [512, 512],
            [0, 512],
        ],
        dtype=np.float32,
    )
    matrix = cv2.getPerspectiveTransform(source, destination)
    return cv2.warpPerspective(image, matrix, (512, 512))


def predict_position(image_path: Path) -> dict[str, Any]:
    predictor = get_predictor()
    result = predictor.predict_chessboard(str(image_path), fen_type="compressed")
    placement_fen = str(result["fen"])
    square_confidences = build_square_confidences(result.get("predictions", []))

    return {
        "placementFen": placement_fen,
        "confidence": average_confidence(square_confidences),
        "orientationGuess": "white",
        "squareConfidences": square_confidences,
        "needsReview": True,
    }


def build_square_confidences(
    predictions: list[tuple[str, str, float]] | list[list[Any]]
) -> list[dict[str, Any]]:
    square_confidences: list[dict[str, Any]] = []
    for square, piece, probability in predictions:
        square_confidences.append(
            {
                "square": square,
                "predictedPiece": None if piece == "1" else piece,
                "confidence": float(probability),
            }
        )
    return square_confidences


def average_confidence(square_confidences: list[dict[str, Any]]) -> float:
    if not square_confidences:
        return 0.0
    total = sum(float(item["confidence"]) for item in square_confidences)
    return total / len(square_confidences)


def get_predictor():
    global _PREDICTOR

    if _PREDICTOR is not None:
        return _PREDICTOR

    try:
        from chessimg2pos.constants import DEFAULT_CLASSIFIER
        from chessimg2pos.model_loader import download_pretrained_model
        from chessimg2pos.predictor import ChessPositionPredictor
    except ImportError as error:  # pragma: no cover - dependency failure path
        raise RuntimeError(
            "The chessimg2pos package is not installed. Bootstrap the vision service first."
        ) from error

    model_path = download_pretrained_model(verbose=False)
    _PREDICTOR = ChessPositionPredictor(
        model_path=model_path,
        classifier=DEFAULT_CLASSIFIER,
        verbose=False,
    )
    return _PREDICTOR
