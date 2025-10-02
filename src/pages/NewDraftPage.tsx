import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Stepper,
  Step,
  StepLabel,
  Divider,
  Container,
} from '@mui/material';
import {
  Save,
  Cancel,
  BusinessCenter,
  Description,
  CheckCircleOutline,
  EditNote,
  AutoAwesome,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { draftService } from '../services/draftService';
import { CreateDraftRequest } from '../types/draft.types';

const NewDraftPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateDraftRequest>({
    title: '',
    description: '',
    client_metadata: {
      name: '',
      country: '',
      city: '',
      industry: '',
    },
  });

  const handleChange = (field: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...(formData as any)[parent],
          [child]: event.target.value,
        },
      });
    } else {
      setFormData({
        ...formData,
        [field]: event.target.value,
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await draftService.createDraft(formData);
      navigate(`/drafts/${response.draft_id}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create draft. Please try again.');
      console.error('Error creating draft:', err);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    return (
      formData.title.trim() !== '' &&
      formData.description.trim() !== '' &&
      formData.client_metadata.name.trim() !== '' &&
      formData.client_metadata.country.trim() !== '' &&
      formData.client_metadata.city.trim() !== '' &&
      formData.client_metadata.industry.trim() !== ''
    );
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Description sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" fontWeight={600}>
              Create New Policy Draft
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Initialize a new policy document with AI-powered assistance
            </Typography>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={8}>
          <Paper
            elevation={0}
            sx={{
              p: 4,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2
            }}
          >
            <form onSubmit={handleSubmit}>
              <Box sx={{ mb: 4 }}>
                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <EditNote color="primary" />
                  <Typography variant="h6" fontWeight={500}>
                    Policy Information
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      required
                      fullWidth
                      label="Policy Title"
                      value={formData.title}
                      onChange={handleChange('title')}
                      placeholder="Enter a descriptive title for your policy"
                      helperText="This will be the main title of your policy document"
                      InputProps={{
                        sx: { backgroundColor: 'background.paper' }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      required
                      fullWidth
                      multiline
                      rows={4}
                      label="Description"
                      value={formData.description}
                      onChange={handleChange('description')}
                      placeholder="Provide a detailed description of what this policy covers"
                      helperText="Include the purpose, scope, and key objectives of the policy"
                      InputProps={{
                        sx: { backgroundColor: 'background.paper' }
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ my: 4 }} />

              <Box sx={{ mb: 4 }}>
                <Box display="flex" alignItems="center" gap={1} mb={3}>
                  <BusinessCenter color="primary" />
                  <Typography variant="h6" fontWeight={500}>
                    Client Information
                  </Typography>
                </Box>

                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      required
                      fullWidth
                      label="Client Name"
                      value={formData.client_metadata.name}
                      onChange={handleChange('client_metadata.name')}
                      placeholder="Company or organization"
                      InputProps={{
                        sx: { backgroundColor: 'background.paper' }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      required
                      fullWidth
                      label="Industry"
                      value={formData.client_metadata.industry}
                      onChange={handleChange('client_metadata.industry')}
                      placeholder="e.g., Healthcare, Finance, Technology"
                      helperText="Specify the industry or sector"
                      InputProps={{
                        sx: { backgroundColor: 'background.paper' }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      required
                      fullWidth
                      label="Country"
                      value={formData.client_metadata.country}
                      onChange={handleChange('client_metadata.country')}
                      placeholder="e.g., United Arab Emirates"
                      InputProps={{
                        sx: { backgroundColor: 'background.paper' }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      required
                      fullWidth
                      label="City"
                      value={formData.client_metadata.city}
                      onChange={handleChange('client_metadata.city')}
                      placeholder="e.g., Dubai"
                      InputProps={{
                        sx: { backgroundColor: 'background.paper' }
                      }}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ my: 4 }} />

              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  All fields are required
                </Typography>
                <Box display="flex" gap={2}>
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<Cancel />}
                    onClick={() => navigate('/drafts')}
                    disabled={loading}
                    sx={{ minWidth: 120 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    startIcon={<Save />}
                    disabled={loading || !isFormValid()}
                    sx={{ minWidth: 150 }}
                  >
                    {loading ? 'Creating...' : 'Create Draft'}
                  </Button>
                </Box>
              </Box>
            </form>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: 2,
              mb: 3
            }}
          >
            <Box display="flex" alignItems="center" gap={1} mb={2}>
              <AutoAwesome sx={{ color: 'white' }} />
              <Typography variant="h6" fontWeight={500}>
                AI-Powered Assistance
              </Typography>
            </Box>
            <Typography variant="body2" sx={{ opacity: 0.95 }}>
              Our AI analyzes your requirements and suggests relevant content based on similar policies and best practices in your industry.
            </Typography>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              backgroundColor: 'background.default'
            }}
          >
            <Typography
              variant="h6"
              gutterBottom
              fontWeight={500}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <CheckCircleOutline color="success" />
              Next Steps
            </Typography>

            <Typography variant="body2" color="text.secondary" paragraph>
              After creating your draft, you'll be able to:
            </Typography>

            <Box component="ul" sx={{ pl: 2, '& li': { mb: 1.5 } }}>
              <Typography component="li" variant="body2" color="text.secondary">
                <strong>Review TOC:</strong> Edit the AI-suggested table of contents
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                <strong>Generate Content:</strong> Create section content with AI
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                <strong>Refine & Edit:</strong> Customize the generated content
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                <strong>Export:</strong> Download as Word document
              </Typography>
            </Box>
          </Paper>

          <Box sx={{ mt: 3 }}>
            <Stepper orientation="vertical" activeStep={0}>
              <Step>
                <StepLabel>
                  <Typography variant="body2">Initialize Draft</Typography>
                </StepLabel>
              </Step>
              <Step>
                <StepLabel>
                  <Typography variant="body2">Structure Content</Typography>
                </StepLabel>
              </Step>
              <Step>
                <StepLabel>
                  <Typography variant="body2">Generate Sections</Typography>
                </StepLabel>
              </Step>
              <Step>
                <StepLabel>
                  <Typography variant="body2">Export Document</Typography>
                </StepLabel>
              </Step>
            </Stepper>
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default NewDraftPage;