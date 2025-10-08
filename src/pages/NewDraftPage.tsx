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
  CircularProgress,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Save,
  Cancel,
  BusinessCenter,
  Description,
  CheckCircleOutline,
  EditNote,
  AutoAwesome,
  Warning,
  CheckCircle,
  Info,
  Error as ErrorIcon,
  Lightbulb
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { draftService } from '../services/draftService';
import { CreateDraftRequest, ValidateDraftResponse } from '../types/draft.types';

const NewDraftPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidateDraftResponse | null>(null);
  const [showImprovedDescription, setShowImprovedDescription] = useState(false);
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
    // Clear validation when user modifies the form
    if (field === 'description' && validationResult) {
      setValidationResult(null);
      setShowImprovedDescription(false);
    }

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

  const validateDraft = async () => {
    setValidating(true);
    setError(null);

    try {
      const result = await draftService.validateDraft(formData);
      setValidationResult(result);

      if (!result.is_valid && result.improved_description) {
        setShowImprovedDescription(true);
      }

      return result;
    } catch (err: any) {
      setError('Failed to validate draft. Please try again.');
      console.error('Error validating draft:', err);
      return null;
    } finally {
      setValidating(false);
    }
  };

  const useImprovedDescription = () => {
    if (validationResult?.improved_description) {
      setFormData({
        ...formData,
        description: validationResult.improved_description
      });
      setShowImprovedDescription(false);
      setValidationResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // First validate the draft
    const validation = await validateDraft();

    if (!validation) {
      return; // Validation failed with error
    }

    if (!validation.is_valid) {
      // Don't proceed if validation failed
      setError('Please fix the issues with your description before creating the draft.');
      return;
    }

    setLoading(true);

    try {
      const response = await draftService.createDraft(formData);
      // Pass the TOC source info through navigation state
      navigate(`/drafts/${response.draft_id}`, {
        state: { tocSource: response.toc_source }
      });
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
                    <Box>
                      <TextField
                        required
                        fullWidth
                        multiline
                        rows={4}
                        label="Description"
                        value={formData.description}
                        onChange={handleChange('description')}
                        placeholder="Provide a detailed description of what this policy covers"
                        helperText={validationResult && !validationResult.is_valid ?
                          "Description needs improvement - see issues below" :
                          "Include the purpose, scope, and key objectives of the policy"}
                        error={validationResult ? !validationResult.is_valid : false}
                        InputProps={{
                          sx: { backgroundColor: 'background.paper' }
                        }}
                      />

                      {/* Validation Feedback */}
                      {validationResult && (
                        <Box sx={{ mt: 2 }}>
                          {/* Quality Score */}
                          <Box sx={{ mb: 2 }}>
                            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                              <Typography variant="body2" color="text.secondary">
                                Description Quality (minimum 50% required)
                              </Typography>
                              <Box display="flex" alignItems="center" gap={1}>
                                {validationResult.description_quality_score < 50 && (
                                  <Chip
                                    size="small"
                                    label="Below Minimum"
                                    color="error"
                                    variant="outlined"
                                  />
                                )}
                                <Chip
                                  size="small"
                                  label={`${validationResult.description_quality_score}%`}
                                  color={validationResult.description_quality_score >= 60 ? "success" :
                                         validationResult.description_quality_score >= 50 ? "warning" : "error"}
                                />
                              </Box>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={validationResult.description_quality_score}
                              sx={{
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: 'grey.300',
                                '& .MuiLinearProgress-bar': {
                                  borderRadius: 4,
                                  backgroundColor: validationResult.description_quality_score >= 60 ? 'success.main' :
                                                   validationResult.description_quality_score >= 50 ? 'warning.main' : 'error.main'
                                }
                              }}
                            />
                            <Box display="flex" justifyContent="space-between" mt={0.5}>
                              <Typography variant="caption" color="text.secondary">
                                Poor (0-49%)
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Acceptable (50-69%)
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Good (70%+)
                              </Typography>
                            </Box>
                          </Box>

                          {/* Issues */}
                          {validationResult.issues.length > 0 && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                <strong>Issues Found:</strong>
                              </Typography>
                              <List dense sx={{ py: 0 }}>
                                {validationResult.issues.map((issue, index) => (
                                  <ListItem key={index} sx={{ py: 0, px: 0 }}>
                                    <ListItemIcon sx={{ minWidth: 28 }}>
                                      <ErrorIcon fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText primary={issue} />
                                  </ListItem>
                                ))}
                              </List>
                            </Alert>
                          )}

                          {/* Suggestions */}
                          {validationResult.suggestions.length > 0 && (
                            <Alert severity="info" sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" gutterBottom>
                                <strong>Suggestions:</strong>
                              </Typography>
                              <List dense sx={{ py: 0 }}>
                                {validationResult.suggestions.map((suggestion, index) => (
                                  <ListItem key={index} sx={{ py: 0, px: 0 }}>
                                    <ListItemIcon sx={{ minWidth: 28 }}>
                                      <Lightbulb fontSize="small" />
                                    </ListItemIcon>
                                    <ListItemText primary={suggestion} />
                                  </ListItem>
                                ))}
                              </List>
                            </Alert>
                          )}

                          {/* Improved Description */}
                          {showImprovedDescription && validationResult.improved_description && (
                            <Alert
                              severity="success"
                              sx={{ mb: 2 }}
                              action={
                                <Button
                                  color="inherit"
                                  size="small"
                                  onClick={useImprovedDescription}
                                  startIcon={<AutoAwesome />}
                                >
                                  Use This
                                </Button>
                              }
                            >
                              <Typography variant="subtitle2" gutterBottom>
                                <strong>Suggested Improved Description:</strong>
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                                "{validationResult.improved_description}"
                              </Typography>
                            </Alert>
                          )}
                        </Box>
                      )}

                      {/* Manual Validation Button */}
                      {formData.description.trim().length > 0 && !validationResult && (
                        <Box sx={{ mt: 2 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={validateDraft}
                            disabled={validating}
                            startIcon={validating ? <CircularProgress size={16} /> : <CheckCircle />}
                          >
                            {validating ? 'Validating...' : 'Check Description Quality'}
                          </Button>
                        </Box>
                      )}
                    </Box>
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
                    startIcon={loading || validating ? <CircularProgress size={20} color="inherit" /> : <Save />}
                    disabled={loading || validating || !isFormValid()}
                    sx={{ minWidth: 150 }}
                  >
                    {validating ? 'Validating...' : loading ? 'Creating...' : 'Create Draft'}
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