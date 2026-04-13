import { useEffect, useRef } from "react";
import styles from "./CameraCaptureModal.module.css";

interface CameraCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCaptured: (dataUrl: string) => void;
}

export default function CameraCaptureModal(props: CameraCaptureModalProps) {
  const { open, onClose, onCaptured } = props;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function startCamera() {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "environment"
        }
      });

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <video ref={videoRef} autoPlay className={styles.video} muted playsInline />
        <p className={styles.subtle}>
          Capture a straight-on board photo, then continue into the crop and perspective review.
        </p>
        <div className={styles.buttonRow}>
          <button
            className={styles.button}
            onClick={() => {
              if (!videoRef.current) {
                return;
              }

              const canvas = document.createElement("canvas");
              canvas.width = videoRef.current.videoWidth;
              canvas.height = videoRef.current.videoHeight;
              const context = canvas.getContext("2d");
              context?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
              onCaptured(canvas.toDataURL("image/png"));
            }}
            type="button"
          >
            Capture Frame
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
