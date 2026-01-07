import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, RotateCw, ZoomIn } from 'lucide-react';
import { getCroppedImg } from '../../utils/imageUtils';

interface ImageCropperProps {
    image: string;
    onCropComplete: (croppedImage: Blob) => void;
    onCancel: () => void;
}

export function ImageCropper({ image, onCropComplete, onCancel }: ImageCropperProps) {
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

    const onCropChange = (crop: { x: number; y: number }) => {
        setCrop(crop);
    };

    const onCropAreaComplete = useCallback((_unfilteredCroppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    const handleCrop = async () => {
        try {
            const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
            if (croppedImage) {
                onCropComplete(croppedImage);
            }
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#0f0d0e] flex flex-col">
            {/* Header */}
            <div className="p-4 flex items-center justify-between border-b border-white/10 bg-[#1a1617]">
                <button
                    onClick={onCancel}
                    className="p-2 text-[#b8b2b3] hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>
                <h3 className="text-white font-semibold text-lg">Ritaglia Immagine</h3>
                <button
                    onClick={handleCrop}
                    className="bg-gradient-to-b from-[#e6a23c] to-[#f4bf4f] text-[#0f0d0e] p-2 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all"
                >
                    <Check size={24} />
                </button>
            </div>

            {/* Cropper Container */}
            <div className="flex-1 relative bg-black">
                <Cropper
                    image={image}
                    crop={crop}
                    zoom={zoom}
                    rotation={rotation}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={onCropChange}
                    onCropComplete={onCropAreaComplete}
                    onZoomChange={setZoom}
                    onRotationChange={setRotation}
                />
            </div>

            {/* Controls Container (Glassmorphism) */}
            <div className="p-6 bg-[#1a1617]/90 backdrop-blur-md border-t border-white/10 flex flex-col gap-6">
                {/* Zoom Control */}
                <div className="flex items-center gap-4">
                    <ZoomIn size={20} className="text-[#f4bf4f]" />
                    <input
                        type="range"
                        value={zoom}
                        min={1}
                        max={3}
                        step={0.1}
                        aria-labelledby="Zoom"
                        onChange={(e) => setZoom(Number(e.target.value))}
                        className="flex-1 h-1.5 bg-[#241f20] rounded-lg appearance-none cursor-pointer accent-[#f4bf4f]"
                    />
                </div>

                {/* Rotation Control */}
                <div className="flex items-center gap-4">
                    <RotateCw size={20} className="text-[#f4bf4f]" />
                    <input
                        type="range"
                        value={rotation}
                        min={0}
                        max={360}
                        step={1}
                        aria-labelledby="Rotation"
                        onChange={(e) => setRotation(Number(e.target.value))}
                        className="flex-1 h-1.5 bg-[#241f20] rounded-lg appearance-none cursor-pointer accent-[#f4bf4f]"
                    />
                </div>

                <div className="text-center text-[#b8b2b3] text-sm">
                    Trascina per spostare, usa gli slider per adattare
                </div>
            </div>
        </div>
    );
}
