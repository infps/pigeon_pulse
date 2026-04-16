"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Camera, Upload, Trash2, CropIcon, Bird } from "lucide-react";

interface ImageCaptureProps {
  value: string | null;
  onChange: (imageUrl: string | null, imageFile?: File | null) => void;
  aspect?: number;
  disabled?: boolean;
}

export function ImageCapture({
  value,
  onChange,
  aspect = 1,
  disabled = false,
}: ImageCaptureProps) {
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [croppedImageUrl, setCroppedImageUrl] = useState("");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check camera support on mount
  useEffect(() => {
    setCameraSupported(
      typeof navigator !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia
    );
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraOpen(true);
      // Attach stream after dialog renders
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch {
      setCameraSupported(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    stopCamera();
    setCapturedImage(dataUrl);
    setCropOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedImage(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(
      centerCrop(
        makeAspectCrop({ unit: "%", width: 80 }, aspect, width, height),
        width,
        height
      )
    );
  }

  function onCropComplete(c: PixelCrop) {
    if (imgRef.current && c.width && c.height) {
      const canvas = document.createElement("canvas");
      const image = imgRef.current;
      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      canvas.width = c.width * scaleX;
      canvas.height = c.height * scaleY;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        image,
        c.x * scaleX,
        c.y * scaleY,
        c.width * scaleX,
        c.height * scaleY,
        0,
        0,
        canvas.width,
        canvas.height
      );
      setCroppedImageUrl(canvas.toDataURL("image/png", 1.0));
    }
  }

  function dataURLtoFile(dataurl: string, filename: string): File {
    const arr = dataurl.split(",");
    const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  }

  function handleCropDone() {
    const url = croppedImageUrl || capturedImage;
    if (!url) return;
    const file = dataURLtoFile(url, `bird-${Date.now()}.png`);
    onChange(url, file);
    setCropOpen(false);
    setCapturedImage(null);
  }

  function handleRemove() {
    onChange(null, null);
  }

  return (
    <>
      <div className="relative w-full aspect-square rounded-lg border-2 border-dashed border-muted-foreground/30 overflow-hidden bg-muted/20">
        {value ? (
          <>
            <img
              src={value}
              alt="Bird"
              className="w-full h-full object-cover"
            />
            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={handleRemove}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full text-muted-foreground">
            <Bird className="h-16 w-16 mb-2 opacity-40" />
            <p className="text-sm">No photo</p>
          </div>
        )}

        {!disabled && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
            {cameraSupported && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 shadow-md"
                onClick={startCamera}
              >
                <Camera className="h-4 w-4 mr-1" />
                Camera
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 shadow-md"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Camera Dialog */}
      <Dialog
        open={cameraOpen}
        onOpenChange={(open) => {
          if (!open) stopCamera();
        }}
      >
        <DialogContent className="max-w-lg p-0 gap-0">
          <div className="p-4">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg bg-black"
            />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          <DialogFooter className="p-4 pt-0">
            <DialogClose asChild>
              <Button variant="outline" size="sm" onClick={stopCamera}>
                Cancel
              </Button>
            </DialogClose>
            <Button size="sm" onClick={capturePhoto}>
              <Camera className="h-4 w-4 mr-1" />
              Capture
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crop Dialog */}
      <Dialog
        open={cropOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCropOpen(false);
            setCapturedImage(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl p-0 gap-0">
          <div className="p-6 w-full">
            {capturedImage && (
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={onCropComplete}
                aspect={aspect}
                className="w-full max-h-[70vh]"
              >
                <img
                  ref={imgRef}
                  src={capturedImage}
                  alt="Crop preview"
                  className="w-full"
                  onLoad={onImageLoad}
                />
              </ReactCrop>
            )}
          </div>
          <DialogFooter className="p-6 pt-0 justify-center">
            <DialogClose asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setCapturedImage(null);
                  setCropOpen(false);
                }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Cancel
              </Button>
            </DialogClose>
            <Button size="sm" onClick={handleCropDone}>
              <CropIcon className="mr-1.5 h-4 w-4" />
              Crop & Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
