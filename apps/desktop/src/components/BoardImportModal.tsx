import { useEffect, useRef, useState } from "react";
import type { BoardImportRequest } from "@shared/contracts";
import styles from "./BoardImportModal.module.css";

type BoardImportDraft = BoardImportRequest & {
  crop: { x: number; y: number; width: number; height: number };
  perspectiveCorners: [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number }
  ];
};

interface BoardImportModalProps {
  open: boolean;
  imagePath?: string;
  imageDataUrl?: string;
  draft: BoardImportDraft;
  onClose: () => void;
  onChange: (patch: Partial<BoardImportDraft>) => void;
  onDetect: () => Promise<void>;
}

export default function BoardImportModal(props: BoardImportModalProps) {
  const { open, imagePath, imageDataUrl, draft, onClose, onChange, onDetect } = props;
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [draggingCorner, setDraggingCorner] = useState<number | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (draggingCorner === null) {
      return;
    }

    function onPointerMove(event: PointerEvent) {
      if (draggingCorner === null) {
        return;
      }

      const bounds = previewRef.current?.getBoundingClientRect();
      if (!bounds) {
        return;
      }

      const x = clamp((event.clientX - bounds.left) / bounds.width);
      const y = clamp((event.clientY - bounds.top) / bounds.height);
      const next = [...draft.perspectiveCorners] as typeof draft.perspectiveCorners;
      next[draggingCorner] = { x, y };
      onChange({ perspectiveCorners: next });
    }

    function onPointerUp() {
      setDraggingCorner(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingCorner, draft.perspectiveCorners, onChange]);

  if (!open) {
    return null;
  }

  const imageSrc = imageDataUrl ?? (imagePath ? `file://${imagePath}` : "");

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <div ref={previewRef} className={styles.previewFrame}>
          {imageSrc ? (
            <>
              <img
                alt="Board preview"
                className={styles.image}
                src={imageSrc}
                style={{ transform: `rotate(${draft.rotationDeg ?? 0}deg)` }}
              />
              <div className={styles.overlay}>
                <div
                  className={styles.cropBox}
                  style={{
                    left: `${draft.crop.x * 100}%`,
                    top: `${draft.crop.y * 100}%`,
                    width: `${draft.crop.width * 100}%`,
                    height: `${draft.crop.height * 100}%`
                  }}
                />
                {draft.perspectiveCorners.map((corner, index) => (
                  <button
                    className={styles.corner}
                    key={`${corner.x}-${corner.y}-${index}`}
                    onPointerDown={() => setDraggingCorner(index)}
                    style={{
                      left: `${corner.x * 100}%`,
                      top: `${corner.y * 100}%`
                    }}
                    type="button"
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className={styles.controls}>
          <label className={styles.label}>
            Rotation
            <input
              className={styles.range}
              max={180}
              min={-180}
              onChange={(event) =>
                onChange({ rotationDeg: Number(event.target.value) })
              }
              type="range"
              value={draft.rotationDeg ?? 0}
            />
          </label>
          <label className={styles.label}>
            Crop X
            <input
              className={styles.range}
              max={1}
              min={0}
              onChange={(event) =>
                onChange({
                  crop: {
                    ...draft.crop,
                    x: Number(event.target.value)
                  }
                })
              }
              step={0.01}
              type="range"
              value={draft.crop.x}
            />
          </label>
          <label className={styles.label}>
            Crop Y
            <input
              className={styles.range}
              max={1}
              min={0}
              onChange={(event) =>
                onChange({
                  crop: {
                    ...draft.crop,
                    y: Number(event.target.value)
                  }
                })
              }
              step={0.01}
              type="range"
              value={draft.crop.y}
            />
          </label>
          <label className={styles.label}>
            Crop Width
            <input
              className={styles.range}
              max={1 - draft.crop.x}
              min={0.1}
              onChange={(event) =>
                onChange({
                  crop: {
                    ...draft.crop,
                    width: Number(event.target.value)
                  }
                })
              }
              step={0.01}
              type="range"
              value={draft.crop.width}
            />
          </label>
          <label className={styles.label}>
            Crop Height
            <input
              className={styles.range}
              max={1 - draft.crop.y}
              min={0.1}
              onChange={(event) =>
                onChange({
                  crop: {
                    ...draft.crop,
                    height: Number(event.target.value)
                  }
                })
              }
              step={0.01}
              type="range"
              value={draft.crop.height}
            />
          </label>
        </div>

        <p className={styles.subtle}>
          Adjust crop and drag the four corner handles so the board outline matches the picture
          before detection runs.
        </p>

        <div className={styles.buttonRow}>
          <button
            className={styles.button}
            disabled={working}
            onClick={async () => {
              setWorking(true);
              try {
                await onDetect();
              } finally {
                setWorking(false);
              }
            }}
            type="button"
          >
            {working ? "Detecting…" : "Detect Pieces"}
          </button>
          <button
            className={`${styles.button} ${styles.secondaryButton}`}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
