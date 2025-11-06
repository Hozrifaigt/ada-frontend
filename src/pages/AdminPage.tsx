import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Container,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  CloudUpload,
  AdminPanelSettings,
  CheckCircle,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface UploadResult {
  success: boolean;
  message: string;
  templatesCreated?: number;
  errors?: string[];
}

const AdminPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const adminEmails = ['hozayfa.rifai@ae.gt.com'];
    const isAdmin = adminEmails.includes(user.email?.toLowerCase() || '');

    if (!isAdmin) {
      // Redirect non-admin users to drafts page
      navigate('/drafts');
    }
  }, [navigate]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        setError('Please select an Excel file (.xlsx or .xls)');
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
      setError(null);
      setUploadResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a file first');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const token = localStorage.getItem('authToken');
      const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8080';

      const response = await axios.post(
        `${apiBaseUrl}/api/v1/admin/upload-policy-templates`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      setUploadResult({
        success: true,
        message: response.data.message || 'Templates uploaded successfully',
        templatesCreated: response.data.templates_created,
        errors: response.data.errors || [],
      });

      // Clear the file selection after successful upload
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('file-upload') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(
        err.response?.data?.detail ||
        err.message ||
        'Failed to upload file. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <AdminPanelSettings sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" fontWeight={600}>
              Admin Panel
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload policy templates and manage system settings
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {uploadResult && (
          <Alert
            severity={uploadResult.success ? 'success' : 'error'}
            sx={{ mb: 3 }}
            onClose={() => setUploadResult(null)}
            icon={uploadResult.success ? <CheckCircle /> : <ErrorIcon />}
          >
            <Typography variant="subtitle2" gutterBottom>
              {uploadResult.message}
            </Typography>
            {uploadResult.templatesCreated !== undefined && (
              <Typography variant="body2">
                Templates created: {uploadResult.templatesCreated}
              </Typography>
            )}
            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" fontWeight={600}>
                  Errors:
                </Typography>
                {uploadResult.errors.map((err, idx) => (
                  <Typography key={idx} variant="body2" color="error">
                    • {err}
                  </Typography>
                ))}
              </Box>
            )}
          </Alert>
        )}
      </Box>

      <Paper
        elevation={0}
        sx={{
          p: 4,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 2,
        }}
      >
        <Typography variant="h6" fontWeight={500} gutterBottom>
          Upload Policy Templates
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Upload an Excel file containing policy templates with the following columns:
        </Typography>

        <Box sx={{ mb: 3, p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="body2" fontWeight={600} gutterBottom>
            Expected Excel Columns:
          </Typography>
          <Box component="ul" sx={{ pl: 3, m: 0 }}>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              <strong>Function</strong> - e.g., HR, IT, Legal
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              <strong>Policies</strong> - Policy name
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              <strong>Topics</strong> - Topic name
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              <strong>Topic Content</strong> - Content for the topic
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 0.5 }}>
              <strong>Subtopics</strong> - Subtopic name
            </Typography>
            <Typography component="li" variant="body2">
              <strong>Subtopic Content</strong> - Content for the subtopic
            </Typography>
          </Box>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Note:</strong> Empty cells in the Excel file indicate "same as above"
            (merged cells pattern). The system will automatically forward-fill these values.
          </Typography>
        </Alert>

        <Box
          sx={{
            border: '2px dashed',
            borderColor: selectedFile ? 'success.main' : 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            backgroundColor: selectedFile ? 'success.50' : 'background.default',
            mb: 3,
          }}
        >
          <input
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            id="file-upload"
            type="file"
            onChange={handleFileSelect}
          />
          <label htmlFor="file-upload">
            <Button
              variant="outlined"
              component="span"
              startIcon={<CloudUpload />}
              size="large"
            >
              Select Excel File
            </Button>
          </label>

          {selectedFile && (
            <Box sx={{ mt: 2 }}>
              <Chip
                label={selectedFile.name}
                color="success"
                onDelete={() => setSelectedFile(null)}
                sx={{ maxWidth: '100%' }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Size: {(selectedFile.size / 1024).toFixed(2)} KB
              </Typography>
            </Box>
          )}
        </Box>

        <Box display="flex" justifyContent="flex-end">
          <Button
            variant="contained"
            size="large"
            startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            sx={{ minWidth: 150 }}
          >
            {uploading ? 'Uploading...' : 'Upload Templates'}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default AdminPage;
