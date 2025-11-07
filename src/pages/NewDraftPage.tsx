import React, { useState, useEffect } from 'react';
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
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  InputLabel,
  Slider,
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
import { useNavigate, useLocation } from 'react-router-dom';
import { Country, State } from 'country-state-city';
import { draftService } from '../services/draftService';
import { CreateDraftRequest, Draft } from '../types/draft.types';

// Industry options
const INDUSTRY_OPTIONS = [
  'Manufacturing',
  'Telecom',
  'Technology',
  'Media',
  'Government',
  'Healthcare',
  'Hospitality',
  'Finance',
  'Fund',
  'Banking',
  'Family Conglomerate'
];

const NewDraftPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editDraft = (location.state as { editDraft?: Draft })?.editDraft;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get UAE as default country or from edit draft
  const uaeCountry = Country.getAllCountries().find(c => c.isoCode === 'AE');
  const initialCountry = editDraft
    ? Country.getAllCountries().find(c => c.name === editDraft.metadata.client_metadata.country)
    : uaeCountry;
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(initialCountry?.isoCode || 'AE');

  const [formData, setFormData] = useState<CreateDraftRequest>({
    title: editDraft?.metadata.title || '',
    description: editDraft?.metadata.description || '',
    client_metadata: {
      name: editDraft?.metadata.client_metadata.name || '',
      country: editDraft?.metadata.client_metadata.country || uaeCountry?.name || 'United Arab Emirates',
      city: editDraft?.metadata.client_metadata.city || '',
      industry: editDraft?.metadata.client_metadata.industry || '',
    },
    function: editDraft?.metadata.function || '', // Will be set once functions are loaded if not from edit
    policy_type: editDraft?.metadata.policy_type || '',
    client_specific_requests: editDraft?.metadata.client_specific_requests || '',
    sector_specific_comments: editDraft?.metadata.sector_specific_comments || '',
    regulations: editDraft?.metadata.regulations || 'UAE Labor Law',
    detail_level: editDraft?.metadata.detail_level || 3,
  });

  const [functions, setFunctions] = useState<string[]>([]);
  const [loadingFunctions, setLoadingFunctions] = useState(false);
  const [policyTypes, setPolicyTypes] = useState<string[]>([]);
  const [loadingPolicyTypes, setLoadingPolicyTypes] = useState(false);

  // Get all countries and states (for UAE, these are the emirates)
  // Filter out Israel from the country list
  const countries = Country.getAllCountries().filter(country => country.isoCode !== 'IL');
  const states = State.getStatesOfCountry(selectedCountryCode) || [];

  // Fetch available functions on mount
  useEffect(() => {
    const fetchFunctions = async () => {
      setLoadingFunctions(true);
      try {
        const response = await draftService.getFunctions();
        if (response.policy_types.length === 0) {
          // Fallback if no templates uploaded yet
          setFunctions(['HR']);
        } else {
          setFunctions(response.policy_types);
        }
      } catch (err) {
        console.error('Failed to fetch functions:', err);
        setFunctions(['HR']); // Fallback
      } finally {
        setLoadingFunctions(false);
      }
    };

    fetchFunctions();
  }, []);

  // Set default function once functions are loaded (only if not editing)
  useEffect(() => {
    if (functions.length > 0 && !formData.function && !editDraft) {
      setFormData(prev => ({ ...prev, function: functions[0] }));
    }
  }, [functions, editDraft]);

  // Fetch policy types when function changes
  useEffect(() => {
    const fetchPolicyTypes = async () => {
      if (!formData.function) return;

      setLoadingPolicyTypes(true);
      try {
        const response = await draftService.getPolicyTypes(formData.function);
        // If no policy types from backend, use mock data for testing
        if (response.policy_types.length === 0) {
          setPolicyTypes([
            'Recruitment and Selection Policy',
            'Employee Onboarding Policy',
            'Performance Management Policy',
            'Leave and Absence Policy',
            'Compensation and Benefits Policy'
          ]);
        } else {
          setPolicyTypes(response.policy_types);
        }
      } catch (err) {
        console.error('Failed to fetch policy types:', err);
        // Fallback to mock data if API fails
        setPolicyTypes([
          'Recruitment and Selection Policy',
          'Employee Onboarding Policy',
          'Performance Management Policy',
          'Leave and Absence Policy',
          'Compensation and Benefits Policy'
        ]);
      } finally {
        setLoadingPolicyTypes(false);
      }
    };

    fetchPolicyTypes();
  }, [formData.function]);

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

  const handleCountryChange = (countryIsoCode: string) => {
    const country = countries.find(c => c.isoCode === countryIsoCode);
    if (country) {
      setSelectedCountryCode(countryIsoCode);
      setFormData({
        ...formData,
        client_metadata: {
          ...formData.client_metadata,
          country: country.name,
          city: '', // Clear city when country changes
        },
      });
    }
  };

  const handleCityChange = (stateName: string) => {
    setFormData({
      ...formData,
      client_metadata: {
        ...formData.client_metadata,
        city: stateName,
      },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (editDraft) {
        // Update existing draft metadata
        await draftService.updateDraftMetadata(editDraft.id, formData);
        // Navigate back to the draft
        navigate(`/drafts/${editDraft.id}`);
      } else {
        // Create new draft
        const response = await draftService.createDraft(formData);
        // Pass the TOC source info through navigation state
        navigate(`/drafts/${response.draft_id}`, {
          state: { tocSource: response.toc_source }
        });
      }
    } catch (err: any) {
      const action = editDraft ? 'update' : 'create';
      setError(err.response?.data?.detail || `Failed to ${action} draft. Please try again.`);
      console.error(`Error ${action}ing draft:`, err);
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = () => {
    const validations = {
      title: formData.title.trim() !== '',
      name: formData.client_metadata.name.trim() !== '',
      country: formData.client_metadata.country.trim() !== '',
      city: formData.client_metadata.city.trim() !== '',
      industry: formData.client_metadata.industry.trim() !== '',
      function: formData.function.trim() !== '',
      policy_type: formData.policy_type.trim() !== '',
      regulations: formData.regulations.trim() !== ''
    };

    // Debug: Log which fields are invalid
    const invalidFields = Object.entries(validations)
      .filter(([_, isValid]) => !isValid)
      .map(([field]) => field);

    if (invalidFields.length > 0) {
      console.log('Invalid fields:', invalidFields);
    }

    return Object.values(validations).every(v => v);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Description sx={{ fontSize: 40, color: 'primary.main' }} />
          <Box>
            <Typography variant="h4" fontWeight={600}>
              {editDraft ? 'Edit Draft Metadata' : 'Create New Policy Draft'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {editDraft
                ? 'Update the metadata and details for your policy document'
                : 'Initialize a new policy document with AI-powered assistance'}
            </Typography>
          </Box>
        </Box>

        {editDraft && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <strong>Note:</strong> You are editing the metadata of an existing draft. The changes will be saved to the current draft.
          </Alert>
        )}

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

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Function</InputLabel>
                      <Select
                        value={formData.function}
                        onChange={(e) => setFormData({ ...formData, function: e.target.value, policy_type: '' })}
                        label="Function"
                        disabled={loadingFunctions || functions.length === 0}
                        sx={{ backgroundColor: 'background.paper' }}
                      >
                        {loadingFunctions ? (
                          <MenuItem disabled>
                            <CircularProgress size={20} sx={{ mr: 1 }} /> Loading functions...
                          </MenuItem>
                        ) : functions.length === 0 ? (
                          <MenuItem disabled>No functions available</MenuItem>
                        ) : (
                          functions.map((func) => (
                            <MenuItem key={func} value={func}>
                              {func}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Policy Type</InputLabel>
                      <Select
                        value={formData.policy_type}
                        onChange={(e) => setFormData({ ...formData, policy_type: e.target.value })}
                        label="Policy Type"
                        disabled={loadingPolicyTypes || policyTypes.length === 0}
                        sx={{ backgroundColor: 'background.paper' }}
                      >
                        {loadingPolicyTypes ? (
                          <MenuItem disabled>
                            <CircularProgress size={20} sx={{ mr: 1 }} /> Loading policies...
                          </MenuItem>
                        ) : policyTypes.length === 0 ? (
                          <MenuItem disabled>No policy types available</MenuItem>
                        ) : (
                          policyTypes.map((type) => (
                            <MenuItem key={type} value={type}>
                              {type}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Client Specific Requests"
                      value={formData.client_specific_requests}
                      onChange={handleChange('client_specific_requests')}
                      placeholder="Describe any specific requirements or customizations for this client"
                      helperText="Optional: Add any unique business needs, industry-specific requirements, or custom policies"
                      InputProps={{
                        sx: { backgroundColor: 'background.paper' }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      label="Sector Specific Comments"
                      value={formData.sector_specific_comments}
                      onChange={handleChange('sector_specific_comments')}
                      placeholder="Add any sector-specific considerations or requirements"
                      helperText="Optional: Include any sector-specific regulations, standards, or best practices"
                      InputProps={{
                        sx: { backgroundColor: 'background.paper' }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Regulations</InputLabel>
                      <Select
                        value={formData.regulations}
                        onChange={(e) => setFormData({ ...formData, regulations: e.target.value })}
                        label="Regulations"
                        sx={{ backgroundColor: 'background.paper' }}
                      >
                        <MenuItem value="UAE Labor Law">UAE Labor Law</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <FormLabel sx={{ mb: 2 }}>
                        Level of Details
                      </FormLabel>
                      <Box sx={{ px: 2 }}>
                        <Slider
                          value={formData.detail_level}
                          onChange={(_, value) => setFormData({ ...formData, detail_level: value as number })}
                          min={1}
                          max={5}
                          step={1}
                          marks={[
                            { value: 1, label: '1 - Light' },
                            { value: 2, label: '2' },
                            { value: 3, label: '3' },
                            { value: 4, label: '4' },
                            { value: 5, label: '5 - Heavy' }
                          ]}
                          valueLabelDisplay="auto"
                          sx={{ mt: 1 }}
                        />
                      </Box>
                    </FormControl>
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
                    <FormControl fullWidth required>
                      <InputLabel>Industry</InputLabel>
                      <Select
                        value={formData.client_metadata.industry}
                        onChange={(e) => {
                          setFormData(prev => ({
                            ...prev,
                            client_metadata: {
                              ...prev.client_metadata,
                              industry: e.target.value
                            }
                          }));
                        }}
                        label="Industry"
                        sx={{ backgroundColor: 'background.paper' }}
                      >
                        {INDUSTRY_OPTIONS.map((industry) => (
                          <MenuItem key={industry} value={industry}>
                            {industry}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Country</InputLabel>
                      <Select
                        value={selectedCountryCode}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        label="Country"
                        sx={{ backgroundColor: 'background.paper' }}
                      >
                        {countries.map((country) => (
                          <MenuItem key={country.isoCode} value={country.isoCode}>
                            {country.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth required>
                      <InputLabel>City / Emirate</InputLabel>
                      <Select
                        value={formData.client_metadata.city}
                        onChange={(e) => handleCityChange(e.target.value)}
                        label="City / Emirate"
                        disabled={states.length === 0}
                        sx={{ backgroundColor: 'background.paper' }}
                      >
                        {states.length === 0 ? (
                          <MenuItem disabled>No regions available</MenuItem>
                        ) : (
                          states.map((state) => (
                            <MenuItem key={state.isoCode} value={state.name}>
                              {state.name}
                            </MenuItem>
                          ))
                        )}
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>
              </Box>

              <Divider sx={{ my: 4 }} />

              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  * Required fields
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
                    startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <Save />}
                    disabled={loading || !isFormValid()}
                    sx={{ minWidth: 150 }}
                  >
                    {loading
                      ? (editDraft ? 'Updating...' : 'Creating...')
                      : (editDraft ? 'Save Changes' : 'Create Draft')}
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