import React, { useState, useRef } from 'react';
import Icon from '../common/Icon';
import * as documentsApi from '../../api/documents';

export default function UploadZone({ onUploadSuccess }) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
    else if (e.type === "dragleave") setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
      // Reset input value so re-selecting same file triggers change
      e.target.value = '';
    }
  };

  const handleFileUpload = async (file) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      alert('Only PDF files are supported.');
      return;
    }
    
    setIsUploading(true);
    try {
      await documentsApi.uploadDocument(file);
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (e) {
      console.error('Upload error:', e);
      alert('Upload failed: ' + (e?.response?.data?.detail || e.message));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div 
      className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
        isDragging ? 'border-primary bg-primary/5' : 'border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low'
      } ${isUploading ? 'opacity-70 pointer-events-none' : ''}`}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => !isUploading && fileInputRef.current?.click()}
    >
      <input 
        ref={fileInputRef} 
        type="file" 
        accept=".pdf" 
        className="hidden" 
        onChange={handleChange} 
      />
      <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center mx-auto mb-4">
        <Icon name={isUploading ? "sync" : "upload_file"} className={isUploading ? "animate-spin" : ""} />
      </div>
      <h3 className="text-headline-md text-on-surface mb-2">
        {isUploading ? 'Uploading & Processing Textbook...' : 'Upload Curriculum Materials'}
      </h3>
      <p className="text-body-sm text-on-surface-variant">
        {isUploading ? 'Your document is being sent to the library pipeline.' : 'Drag and drop PDF files here, or click to browse'}
      </p>
    </div>
  );
}
