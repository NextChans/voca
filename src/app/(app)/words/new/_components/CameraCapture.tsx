'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 페이지 안에서 카메라를 직접 띄워 촬영한다.
 * <input capture> 는 "힌트"라서 PC·일부 안드로이드/인앱 브라우저에서는 파일 선택창이 뜨므로
 * getUserMedia 로 후면 카메라 미리보기 + 셔터를 제공한다.
 */
export function canUseCamera(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;
}

export function CameraCapture({
  onCapture,
  onCancel,
  onUnavailable,
}: {
  onCapture: (file: File) => void;
  onCancel: () => void;
  /** 권한 거부·카메라 없음 → 호출측이 파일 선택으로 폴백 */
  onUnavailable: (reason: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
          setReady(true);
        }
      } catch (e) {
        const name = e instanceof DOMException ? e.name : '';
        onUnavailable(
          name === 'NotAllowedError'
            ? '카메라 권한이 꺼져 있어요. 브라우저 설정에서 카메라를 허용하거나, 사진을 골라 주세요.'
            : '카메라를 열 수 없어요. 사진을 골라 주세요.'
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // 마운트 시 1회만 카메라를 연다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shoot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      0.92
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="카메라">
      <video ref={videoRef} playsInline muted className="min-h-0 flex-1 object-contain" />
      {!ready && (
        <p className="absolute inset-x-0 top-1/2 text-center text-white/80" aria-live="polite">
          카메라 여는 중…
        </p>
      )}
      <div className="flex items-center justify-between gap-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" className="btn-secondary w-24" onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          aria-label="촬영"
          disabled={!ready}
          onClick={shoot}
          className="h-18 w-18 rounded-full border-4 border-white bg-white/90 shadow-lg active:scale-95 disabled:opacity-40"
        />
        <span className="w-24" />
      </div>
    </div>
  );
}
