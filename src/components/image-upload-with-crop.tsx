"use client"

import React, { type SyntheticEvent } from "react"
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop"
import { FileWithPath, useDropzone } from "react-dropzone"
import "react-image-crop/dist/ReactCrop.css"
import { CropIcon, Trash2Icon, UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog"

export type FileWithPreview = FileWithPath & {
  preview: string
}

interface ImageUploadWithCropProps {
  aspect: number // e.g., 1 for square, 16/9 for banner
  value: string | null // URL of the cropped image
  onChange: (imageUrl: string | null, imageFile?: File | null) => void
  className?: string
  placeholder?: string
}

export function ImageUploadWithCrop({
  aspect,
  value,
  onChange,
  className = "",
  placeholder = "Click or drag to upload image",
}: ImageUploadWithCropProps) {
  const [selectedFile, setSelectedFile] = React.useState<FileWithPreview | null>(null)
  const [isDialogOpen, setDialogOpen] = React.useState(false)
  const [crop, setCrop] = React.useState<Crop>()
  const [croppedImageUrl, setCroppedImageUrl] = React.useState<string>("")

  const imgRef = React.useRef<HTMLImageElement | null>(null)

  const accept = {
    "image/*": [],
  }

  const onDrop = React.useCallback(
    (acceptedFiles: FileWithPath[]) => {
      const file = acceptedFiles[0]
      if (!file) {
        alert("Selected image is too large!")
        return
      }

      const fileWithPreview = Object.assign(file, {
        preview: URL.createObjectURL(file),
      })

      setSelectedFile(fileWithPreview)
      setDialogOpen(true)
    },
    [],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: false,
  })

  function onImageLoad(e: SyntheticEvent<HTMLImageElement>) {
    if (aspect) {
      const { width, height } = e.currentTarget
      setCrop(centerAspectCrop(width, height, aspect))
    }
  }

  function onCropComplete(crop: PixelCrop) {
    if (imgRef.current && crop.width && crop.height) {
      const croppedUrl = getCroppedImg(imgRef.current, crop)
      setCroppedImageUrl(croppedUrl)
    }
  }

  function getCroppedImg(image: HTMLImageElement, crop: PixelCrop): string {
    const canvas = document.createElement("canvas")
    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    canvas.width = crop.width * scaleX
    canvas.height = crop.height * scaleY

    const ctx = canvas.getContext("2d")

    if (ctx) {
      ctx.imageSmoothingEnabled = false

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width * scaleX,
        crop.height * scaleY,
      )
    }

    return canvas.toDataURL("image/png", 1.0)
  }

  // Convert base64 to File
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

  function onCrop() {
    try {
      const imageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
      onChange(croppedImageUrl, imageFile);
      setDialogOpen(false);
      setSelectedFile(null);
    } catch (error) {
      alert("Something went wrong!");
    }
  }

  function handleRemove() {
    onChange(null, null);
  }

  return (
    <>
      <div
        {...getRootProps()}
        className={`relative border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"
        } ${className}`}
      >
        <input {...getInputProps()} />
        {value ? (
          <div className="relative w-full h-full">
            <img
              src={value}
              alt="Uploaded"
              className="w-full h-full object-cover rounded-lg"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={(e) => {
                e.stopPropagation()
                handleRemove()
              }}
            >
              <Trash2Icon className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center w-full h-full p-6 text-center">
            <UploadIcon className="h-10 w-10 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">{placeholder}</p>
            <p className="text-xs text-gray-400 mt-1">
              Aspect ratio: {aspect === 1 ? "Square (1:1)" : aspect === 16/9 ? "Banner (16:9)" : `${aspect}:1`}
            </p>
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="p-0 gap-0 max-w-3xl">
          <div className="p-6 w-full">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => onCropComplete(c)}
              aspect={aspect}
              className="w-full max-h-[70vh]"
            >
              <img
                ref={imgRef}
                className="w-full"
                alt="Crop preview"
                src={selectedFile?.preview}
                onLoad={onImageLoad}
              />
            </ReactCrop>
          </div>
          <DialogFooter className="p-6 pt-0 justify-center">
            <DialogClose asChild>
              <Button
                size="sm"
                type="button"
                className="w-fit"
                variant="outline"
                onClick={() => {
                  setSelectedFile(null)
                }}
              >
                <Trash2Icon className="mr-1.5 size-4" />
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" size="sm" className="w-fit" onClick={onCrop}>
              <CropIcon className="mr-1.5 size-4" />
              Crop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Helper function to center the crop
function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: "%",
        width: 50,
        height: 50,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}
