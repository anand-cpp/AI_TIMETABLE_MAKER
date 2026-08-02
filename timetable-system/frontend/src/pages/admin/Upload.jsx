import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/ui/PageHeader';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Card from '../../components/ui/Card';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Spinner from '../../components/ui/Spinner';
import api from '../../services/api';
import { formatDate, formatFileSize } from '../../utils/formatters';
import {
  Upload as UploadIcon,
  FileText,
  Image,
  Trash2,
  RefreshCw,
  Eye,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  Loader,
} from 'lucide-react';
import { cn } from '../../utils/cn';

const statusConfig = {
  pending: { label: 'Pending', variant: 'default', icon: Clock },
  processing: { label: 'Processing', variant: 'info', icon: Loader },
  completed: { label: 'OCR Done', variant: 'success', icon: CheckCircle },
  failed: { label: 'OCR Failed', variant: 'danger', icon: AlertCircle },
};

const Upload = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await api.get('/upload');
      setFiles(res.data.data?.files || []);
    } catch {
      toast.error('Failed to load uploaded files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleFileSelect = async (file) => {
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, PNG, and JPG files are allowed');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 10MB');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('File uploaded! OCR processing started in background.');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  };

  const handleDelete = async () => {
    try {
      setDeleteLoading(true);
      await api.delete(`/upload/${deleteTarget._id}`);
      toast.success('File deleted');
      setDeleteTarget(null);
      if (selectedFile?._id === deleteTarget._id) setSelectedFile(null);
      load();
    } catch {
      toast.error('Failed to delete file');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleRetryOcr = async (fileId) => {
    try {
      await api.post(`/upload/${fileId}/retry-ocr`);
      toast.success('OCR retry started');
      load();
    } catch {
      toast.error('Failed to retry OCR');
    }
  };

  const FileIcon = ({ mimeType }) => {
    if (mimeType === 'application/pdf') {
      return <FileText className="w-5 h-5 text-red-500" />;
    }
    return <Image className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div>
      <PageHeader
        title="Upload & OCR"
        description="Upload existing timetable images or PDFs for OCR text extraction"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upload + file list */}
        <div className="lg:col-span-1 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all',
              dragOver
                ? 'border-primary-400 bg-primary-50'
                : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Spinner size="lg" />
                <p className="text-sm text-gray-500">Uploading...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <UploadIcon className="w-6 h-6 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Drop file here or click to browse
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PDF, PNG, JPG up to 10MB
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* File list */}
          <Card padding={false}>
            <div className="px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-700">
                Uploaded Files ({files.length})
              </p>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner />
              </div>
            ) : files.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">
                No files uploaded yet
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {files.map((file) => {
                  const status = statusConfig[file.ocrStatus] || statusConfig.pending;
                  const StatusIcon = status.icon;
                  return (
                    <div
                      key={file._id}
                      onClick={() => setSelectedFile(file)}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors',
                        selectedFile?._id === file._id && 'bg-primary-50'
                      )}
                    >
                      <FileIcon mimeType={file.mimeType} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.originalName}
                        </p>
                        <p className="text-xs text-gray-400">
                          {formatFileSize(file.size)} · {formatDate(file.createdAt)}
                        </p>
                        <div className="mt-1">
                          <Badge variant={status.variant} size="sm">
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {file.ocrStatus === 'failed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleRetryOcr(file._id); }}
                            className="text-gray-400 hover:text-primary-600"
                            title="Retry OCR"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(file); }}
                          className="text-gray-400 hover:text-red-500"
                          title="Delete file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right: OCR result */}
        <div className="lg:col-span-2">
          {!selectedFile ? (
            <Card className="h-full">
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <Eye className="w-12 h-12 text-gray-200 mb-4" />
                <p className="text-gray-400 text-sm">
                  Select a file to view its OCR result
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <Card.Header>
                <div className="flex items-center justify-between">
                  <div>
                    <Card.Title>{selectedFile.originalName}</Card.Title>
                    <Card.Description>
                      {formatFileSize(selectedFile.size)} ·
                      {formatDate(selectedFile.createdAt)}
                    </Card.Description>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </Card.Header>
              <Card.Content>
                {selectedFile.ocrStatus === 'pending' && (
                  <div className="text-center py-8 text-gray-400">
                    <Clock className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">OCR processing pending...</p>
                  </div>
                )}

                {selectedFile.ocrStatus === 'processing' && (
                  <div className="text-center py-8">
                    <Spinner size="lg" className="mx-auto" />
                    <p className="text-sm text-gray-500 mt-3">
                      OCR in progress...
                    </p>
                  </div>
                )}

                {selectedFile.ocrStatus === 'failed' && (
                  <div className="text-center py-8">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                    <p className="text-sm text-red-600 mb-2">
                      OCR failed: {selectedFile.ocrError}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRetryOcr(selectedFile._id)}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      Retry OCR
                    </Button>
                  </div>
                )}

                {selectedFile.ocrStatus === 'completed' && selectedFile.ocrResult && (
                  <div className="space-y-4">
                    {/* Detected info */}
                    {selectedFile.ocrResult.parsedGrid && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs font-semibold text-green-800 mb-1">
                          Detected Information
                        </p>
                        {selectedFile.ocrResult.parsedGrid.detectedDays?.length > 0 && (
                          <p className="text-xs text-green-700">
                            Days: {selectedFile.ocrResult.parsedGrid.detectedDays.join(', ')}
                          </p>
                        )}
                        {selectedFile.ocrResult.parsedGrid.detectedPeriods?.length > 0 && (
                          <p className="text-xs text-green-700">
                            Periods: {selectedFile.ocrResult.parsedGrid.detectedPeriods.join(', ')}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Raw OCR text */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Extracted Text
                      </p>
                      <pre className="text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-auto max-h-96 whitespace-pre-wrap custom-scrollbar font-mono">
                        {selectedFile.ocrResult.rawText || 'No text extracted'}
                      </pre>
                    </div>

                    <p className="text-xs text-gray-400">
                      OCR is best-effort. Review the extracted text and enter
                      data manually if needed.
                    </p>
                  </div>
                )}
              </Card.Content>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleteLoading}
        title="Delete File"
        message={`Delete "${deleteTarget?.originalName}"? This cannot be undone.`}
        confirmText="Delete File"
        variant="danger"
      />
    </div>
  );
};

export default Upload;