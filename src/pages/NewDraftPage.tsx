import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Divider,
  Container,
  CircularProgress,
  FormControl,
  FormLabel,
  Select,
  MenuItem,
  InputLabel,
  Slider,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Save,
  Cancel,
  BusinessCenter,
  Description,
  CheckCircleOutline,
  EditNote,
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
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('xl'));
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
    function: editDraft?.metadata.function || 'HR',
    client_specific_requests: editDraft?.metadata.client_specific_requests || '',
    sector_specific_comments: editDraft?.metadata.sector_specific_comments || '',
    regulations: editDraft?.metadata.regulations || 'UAE Labor Law',
    detail_level: editDraft?.metadata.detail_level || 3,
  });

  // Static list of functions
  const functions = ['HR', 'IT', 'Legal', 'Finance', 'Operations'];

  // Get all countries and states (for UAE, these are the emirates)
  // Filter out Israel from the country list
  const countries = Country.getAllCountries().filter(country => country.isoCode !== 'IL');
  const states = State.getStatesOfCountry(selectedCountryCode) || [];

  // Functions list is now static - no need to fetch from backend

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
      <Box sx={{ mb: isCompact ? 1.5 : 2 }}>
        <Box display="flex" alignItems="center" gap={isCompact ? 1 : 1.5} mb={isCompact ? 1 : 1.5}>
          <Description sx={{ fontSize: isCompact ? 22 : 28, color: 'primary.main' }} />
          <Box>
            <Typography variant={isCompact ? 'body1' : 'h6'} fontWeight={600}>
              {editDraft ? 'Edit Draft Metadata' : 'Create New Policy Draft'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
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

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <Paper
            elevation={0}
            sx={{
              p: isCompact ? 2 : 2.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2
            }}
          >
            <form onSubmit={handleSubmit}>
              <Box sx={{ mb: isCompact ? 1.5 : 2.5 }}>
                <Box display="flex" alignItems="center" gap={1} mb={isCompact ? 1 : 2}>
                  <EditNote color="primary" sx={{ fontSize: isCompact ? 18 : 20 }} />
                  <Typography variant={isCompact ? 'body2' : 'body1'} fontWeight={600}>
                    Policy Information
                  </Typography>
                </Box>

                <Grid container spacing={isCompact ? 1.5 : 3}>
                  <Grid item xs={12}>
                    <TextField
                      required
                      fullWidth
                      size={isCompact ? 'small' : 'medium'}
                      label="Policy Title"
                      value={formData.title}
                      onChange={handleChange('title')}
                      placeholder="Enter a descriptive title for your policy"
                      helperText={isCompact ? undefined : "This will be the main title of your policy document"}
                      InputProps={{
                        sx: { backgroundColor: 'background.paper' }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth required size={isCompact ? 'small' : 'medium'}>
                      <InputLabel>Function</InputLabel>
                      <Select
                        value={formData.function}
                        onChange={(e) => setFormData({ ...formData, function: e.target.value })}
                        label="Function"
                        sx={{ backgroundColor: 'background.paper' }}
                      >
                        {functions.map((func) => (
                          <MenuItem key={func} value={func}>
                            {func}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      size={isCompact ? 'small' : 'medium'}
                      rows={isCompact ? 2 : 3}
                      label="Client Specific Requests"
                      value={formData.client_specific_requests}
                      onChange={handleChange('client_specific_requests')}
                      placeholder="Describe any specific requirements or customizations for this client"
                      helperText={isCompact ? undefined : "Optional: Add any unique business needs, industry-specific requirements, or custom policies"}
                      InputProps={{
                        sx: { backgroundColor: 'background.paper' }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      size={isCompact ? 'small' : 'medium'}
                      rows={isCompact ? 2 : 3}
                      label="Sector Specific Comments"
                      value={formData.sector_specific_comments}
                      onChange={handleChange('sector_specific_comments')}
                      placeholder="Add any sector-specific considerations or requirements"
                      helperText={isCompact ? undefined : "Optional: Include any sector-specific regulations, standards, or best practices"}
                      InputProps={{
                        sx: { backgroundColor: 'background.paper' }
                      }}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth required size={isCompact ? 'small' : 'medium'}>
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
                      <FormLabel sx={{ mb: isCompact ? 1 : 2, fontSize: isCompact ? '0.8rem' : undefined }}>
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

              <Divider sx={{ my: isCompact ? 1.5 : 2.5 }} />

              <Box sx={{ mb: isCompact ? 1.5 : 2.5 }}>
                <Box display="flex" alignItems="center" gap={1} mb={isCompact ? 1 : 2}>
                  <BusinessCenter color="primary" sx={{ fontSize: isCompact ? 18 : 20 }} />
                  <Typography variant={isCompact ? 'body2' : 'body1'} fontWeight={600}>
                    Client Information
                  </Typography>
                </Box>

                <Grid container spacing={isCompact ? 1.5 : 2}>
                  <Grid item xs={12} md={6}>
                    <TextField
                      required
                      fullWidth
                      size={isCompact ? 'small' : 'medium'}
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
                    <FormControl fullWidth required size={isCompact ? 'small' : 'medium'}>
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
                    <FormControl fullWidth required size={isCompact ? 'small' : 'medium'}>
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
                    <FormControl fullWidth required size={isCompact ? 'small' : 'medium'}>
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

              <Divider sx={{ my: isCompact ? 2 : 4 }} />

              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  * Required fields
                </Typography>
                <Box display="flex" gap={isCompact ? 1 : 2}>
                  <Button
                    variant="outlined"
                    size={isCompact ? 'small' : 'large'}
                    startIcon={<Cancel />}
                    onClick={() => navigate('/drafts')}
                    disabled={loading}
                    sx={{ minWidth: isCompact ? 90 : 120 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    size={isCompact ? 'small' : 'large'}
                    startIcon={loading ? <CircularProgress size={isCompact ? 16 : 20} color="inherit" /> : <Save />}
                    disabled={loading || !isFormValid()}
                    sx={{ minWidth: isCompact ? 120 : 150 }}
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
              p: isCompact ? 1.5 : 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              backgroundColor: 'background.default'
            }}
          >
            <Typography
              variant={isCompact ? 'body2' : 'body1'}
              gutterBottom
              fontWeight={600}
              sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
            >
              <CheckCircleOutline color="success" sx={{ fontSize: isCompact ? 18 : 20 }} />
              Next Steps
            </Typography>

            <Typography variant="caption" color="text.secondary" paragraph>
              After creating your draft, you'll be able to:
            </Typography>

            <Box component="ul" sx={{ pl: 2, '& li': { mb: isCompact ? 0.5 : 0.75 } }}>
              <Typography component="li" variant="caption" color="text.secondary">
                <strong>Review TOC:</strong> Edit the AI-suggested table of contents
              </Typography>
              <Typography component="li" variant="caption" color="text.secondary">
                <strong>Generate Content:</strong> Create section content with AI
              </Typography>
              <Typography component="li" variant="caption" color="text.secondary">
                <strong>Refine & Edit:</strong> Customize the generated content
              </Typography>
              <Typography component="li" variant="caption" color="text.secondary">
                <strong>Export:</strong> Download as Word document
              </Typography>
            </Box>
          </Paper>

        </Grid>
      </Grid>
    </Container>
  );
};

export default NewDraftPage;