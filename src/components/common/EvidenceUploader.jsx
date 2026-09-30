import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
  Trash2,
  FileCheck,
  Camera
} from "lucide-react";
import {
  uploadComplaintImage,
  validateImageFile,
  getPublicImageUrl
} from "../../services/storage/complaintImageUpload.js";

export default function EvidenceUploader({
  label = "Upload Evidence Photo",
  description = "PNG, JPG or WebP up to 10MB",
  mediaType = "AFTER", // "BEFORE" | "AFTER"
  userId,
  complaintId,
  uploadedUrls = [],
  onUploadSuccess,
  onRemovePhoto,
  disabled = false,
  maxPhotos = 3
}) {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState(null);

  async function handleFileSelection(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    setError("");

    // Validate
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error || "Invalid file format or size.");
      return;
    }

    if (uploadedUrls.length >= maxPhotos) {
      setError(`Maximum ${maxPhotos} photos allowed.`);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(20);

      const simInterval = setInterval(() => {
        setUploadProgress(p => (p < 85 ? p + 15 : p));
      }, 150);

      const result = await uploadComplaintImage(file, userId || "engineer", complaintId);

      clearInterval(simInterval);
      setUploadProgress(100);

      const publicUrl = result.publicUrl || getPublicImageUrl(result.storagePath);
      onUploadSuccess?.({
        url: publicUrl,
        storagePath: result.storagePath,
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + " MB",
        mediaType
      });

      // Clear input
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to upload image. Please check your connection.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  function handleDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled || uploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
          <Camera size={13} className="text-teal-400" />
          <span>{label}</span>
        </label>
        <span className="text-[11px] text-slate-400">
          {uploadedUrls.length}/{maxPhotos} uploaded
        </span>
      </div>

      {/* Upload Drop Zone */}
      {uploadedUrls.length < maxPhotos && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
            dragActive
              ? "border-teal-400 bg-teal-500/10 scale-[0.99]"
              : "border-white/10 hover:border-teal-500/40 hover:bg-white/5 bg-slate-900/40"
          } ${disabled || uploading ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => handleFileSelection(e.target.files)}
            disabled={disabled || uploading}
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center">
              {uploading ? (
                <UploadCloud size={20} className="animate-bounce" />
              ) : (
                <ImageIcon size={20} />
              )}
            </div>

            {uploading ? (
              <div className="space-y-1.5 w-full max-w-[200px]">
                <p className="text-xs font-medium text-teal-300">Uploading to Secure Storage...</p>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-teal-400 h-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs font-semibold text-slate-200">
                  Click to select or drag & drop photo
                </p>
                <p className="text-[11px] text-slate-400">{description}</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle size={14} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Uploaded Photos Thumbnails */}
      {uploadedUrls.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          {uploadedUrls.map((photo, idx) => {
            const url = typeof photo === "string" ? photo : photo.url;
            const name = photo.name || `Photo #${idx + 1}`;
            return (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-900/80 border border-white/10 hover:border-teal-500/30 transition group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={url}
                    alt={name}
                    className="w-10 h-10 rounded-lg object-cover border border-white/10 shrink-0 cursor-pointer"
                    onClick={() => setPreviewImage(url)}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white truncate">{name}</p>
                    <span className="text-[10px] text-teal-400 flex items-center gap-1">
                      <FileCheck size={10} />
                      Verified Ready
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewImage(url)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
                    title="View Full Size"
                  >
                    <Eye size={13} />
                  </button>
                  {onRemovePhoto && (
                    <button
                      type="button"
                      onClick={() => onRemovePhoto(idx)}
                      disabled={disabled}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Remove Photo"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      <AnimatePresence>
        {previewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewImage(null)}
              className="fixed inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[85vh] bg-[#0c1220] border border-white/10 rounded-3xl overflow-hidden shadow-2xl z-10 flex flex-col"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Evidence Photo Preview
                </span>
                <button
                  onClick={() => setPreviewImage(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 flex items-center justify-center overflow-auto max-h-[75vh]">
                <img
                  src={previewImage}
                  alt="Evidence Full View"
                  className="max-w-full max-h-[70vh] rounded-2xl object-contain shadow-lg"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
