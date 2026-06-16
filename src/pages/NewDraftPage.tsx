import React, { useState, useRef, useEffect } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  CardActions,
  Chip,
  Switch,
  FormControlLabel,
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
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
  AutoAwesome,
  UploadFile,
  Article,
  Gavel,
  PolicyOutlined,
  CheckCircle,
} from '@mui/icons-material';
import { SimilarPolicy, LibraryPolicy } from '../types/draft.types';
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
  // Tracks which action in the similar-policy dialog is in progress:
  // a policy_id when "Use this policy" is clicked, or '__ai__' for "Generate with AI".
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingPoint, setStartingPoint] = useState<'ai' | 'upload'>('ai');
  const [currentPolicyFile, setCurrentPolicyFile] = useState<File | null>(null);
  const [regulationsFiles, setRegulationsFiles] = useState<File[]>([]);
  const [benchmarkMode, setBenchmarkMode] = useState<'upload' | 'browse'>('upload');
  const [benchmarkFile, setBenchmarkFile] = useState<File | null>(null);
  const [benchmarkPolicyId, setBenchmarkPolicyId] = useState<string | null>(null);
  const [reviewIntensity, setReviewIntensity] = useState<'preserve' | 'rebuild'>('preserve');
  const [libraryPolicies, setLibraryPolicies] = useState<LibraryPolicy[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const currentPolicyRef = useRef<HTMLInputElement>(null);
  const regulationsRef = useRef<HTMLInputElement>(null);
  const benchmarkRef = useRef<HTMLInputElement>(null);
  const [pendingDraftId, setPendingDraftId] = useState<string | null>(null);
  const [similarPolicies, setSimilarPolicies] = useState<SimilarPolicy[]>([]);
  const [descriptionCheck, setDescriptionCheck] = useState<{
    is_valid: boolean;
    score: number;
    issues: string[];
    improved_description?: string;
  } | null>(null);
  const [checkingDescription, setCheckingDescription] = useState(false);

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

  // Static list of functions — must match the SharePoint root folder names exactly (case-sensitive)
  const functions = ['Finance', 'Governance', 'HR', 'IT', 'Procurement'];

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

  // Regulations only apply to HR (UAE Labor Law). For any other function, force "None"
  // immediately; restore the HR default when switching back.
  const handleFunctionChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      function: value,
      regulations: value === 'HR'
        ? (prev.regulations === 'None' ? 'UAE Labor Law' : prev.regulations)
        : 'None',
    }));
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

  const handleCurrentPolicyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && !file.name.endsWith('.docx')) {
      setError('Current Client Policy must be a .docx file.');
    } else {
      setError(null);
      setCurrentPolicyFile(file);
    }
  };

  const handleBenchmarkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && !file.name.endsWith('.docx')) {
      setError('Benchmark policy must be a .docx file.');
    } else {
      setError(null);
      setBenchmarkFile(file);
    }
  };

  // Load library policies for the benchmark picker when "Browse library" is active
  useEffect(() => {
    if (startingPoint === 'upload' && benchmarkMode === 'browse') {
      setLoadingLibrary(true);
      draftService.listLibraryPolicies(formData.function)
        .then(setLibraryPolicies)
        .catch(() => setLibraryPolicies([]))
        .finally(() => setLoadingLibrary(false));
    }
  }, [startingPoint, benchmarkMode, formData.function]);

  const handleRegulationsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setError(null);
    setRegulationsFiles(files);
  };

  const handleCheckDescription = async () => {
    setCheckingDescription(true);
    try {
      const result = await draftService.validateDraft(formData);
      setDescriptionCheck({
        is_valid: result.is_valid,
        score: result.description_quality_score,
        issues: result.issues,
        improved_description: result.improved_description ?? undefined,
      });
    } catch {
      setError('Failed to check description. Please try again.');
    } finally {
      setCheckingDescription(false);
    }
  };

  const handleImproveDescription = () => {
    if (!descriptionCheck?.improved_description) return;
    setFormData(prev => ({ ...prev, description: descriptionCheck.improved_description! }));
    setDescriptionCheck(prev => prev ? { ...prev, is_valid: true, issues: [] } : null);
  };

  const handleApplyPolicy = async (policyId: string | null) => {
    if (!pendingDraftId) return;
    setApplyingId(policyId ?? '__ai__');
    try {
      await draftService.applyPolicy(pendingDraftId, policyId);
      navigate(`/drafts/${pendingDraftId}`, {
        state: { tocSource: policyId ? 'similar_policy' : 'ai_generated' }
      });
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to apply policy. Please try again.');
      setSimilarPolicies([]);
      setPendingDraftId(null);
    } finally {
      setApplyingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Normalize "None" regulations selection to empty string so the backend
      // skips regulation retrieval entirely.
      const payload: CreateDraftRequest = {
        ...formData,
        regulations: formData.regulations === 'None' ? '' : formData.regulations,
      };

      if (editDraft) {
        await draftService.updateDraftMetadata(editDraft.id, payload);
        navigate(`/drafts/${editDraft.id}`);
      } else if (startingPoint === 'upload' && currentPolicyFile) {
        const response = await draftService.createDraftFromUpload(
          payload,
          currentPolicyFile,
          null,
          regulationsFiles,
          benchmarkMode === 'upload' ? benchmarkFile : null,
          benchmarkMode === 'browse' ? benchmarkPolicyId : null,
          reviewIntensity
        );
        navigate(`/drafts/${response.draft_id}`, {
          state: { tocSource: response.toc_source }
        });
      } else {
        // Auto-validate description before initializing if not yet checked
        if (formData.description?.trim() && !descriptionCheck) {
          setLoading(false);
          await handleCheckDescription();
          return;
        }
        if (formData.description?.trim() && descriptionCheck && !descriptionCheck.is_valid) {
          setLoading(false);
          return;
        }

        const response = await draftService.createDraft(payload);
        if (response.needs_policy_selection && response.similar_policies?.length) {
          setPendingDraftId(response.draft_id);
          setSimilarPolicies(response.similar_policies);
        } else {
          navigate(`/drafts/${response.draft_id}`, {
            state: { tocSource: response.toc_source }
          });
        }
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
      ...(startingPoint === 'upload' && {
        currentPolicy: currentPolicyFile !== null,
        benchmark: benchmarkMode === 'upload' ? benchmarkFile !== null : benchmarkPolicyId !== null,
      }),
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
              {!editDraft && (
                <Box sx={{ mb: isCompact ? 2 : 3 }}>
                  <Typography variant={isCompact ? 'caption' : 'body2'} fontWeight={600} sx={{ mb: 1.5, display: 'block' }}>
                    Starting Point
                  </Typography>

                  {/* Option cards */}
                  <Grid container spacing={isCompact ? 1.5 : 2}>
                    {/* New Policy card */}
                    <Grid item xs={6}>
                      <Box
                        onClick={() => { setStartingPoint('ai'); setCurrentPolicyFile(null); setRegulationsFiles([]); setBenchmarkFile(null); setBenchmarkPolicyId(null); }}
                        sx={{
                          cursor: 'pointer',
                          borderRadius: 2,
                          p: isCompact ? 1.5 : 2,
                          border: '2px solid',
                          borderColor: startingPoint === 'ai' ? '#667eea' : '#e2e8f0',
                          backgroundColor: startingPoint === 'ai' ? '#f5f3ff' : 'background.paper',
                          transition: 'all 0.25s ease',
                          '&:hover': {
                            borderColor: '#667eea',
                            backgroundColor: '#f5f3ff',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(102,126,234,0.15)',
                          },
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                          <AutoAwesome sx={{
                            fontSize: isCompact ? 18 : 22,
                            color: startingPoint === 'ai' ? '#667eea' : 'text.secondary',
                          }} />
                          <Typography
                            variant={isCompact ? 'body2' : 'body1'}
                            fontWeight={600}
                            color={startingPoint === 'ai' ? '#667eea' : 'text.primary'}
                          >
                            New Policy
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          AI generates a structured TOC from scratch
                        </Typography>
                      </Box>
                    </Grid>

                    {/* Review Policy card */}
                    <Grid item xs={6}>
                      <Box
                        onClick={() => setStartingPoint('upload')}
                        sx={{
                          cursor: 'pointer',
                          borderRadius: 2,
                          p: isCompact ? 1.5 : 2,
                          border: '2px solid',
                          borderColor: startingPoint === 'upload' ? '#764ba2' : '#e2e8f0',
                          backgroundColor: startingPoint === 'upload' ? '#faf5ff' : 'background.paper',
                          transition: 'all 0.25s ease',
                          '&:hover': {
                            borderColor: '#764ba2',
                            backgroundColor: '#faf5ff',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 4px 12px rgba(118,75,162,0.15)',
                          },
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                          <UploadFile sx={{
                            fontSize: isCompact ? 18 : 22,
                            color: startingPoint === 'upload' ? '#764ba2' : 'text.secondary',
                          }} />
                          <Typography
                            variant={isCompact ? 'body2' : 'body1'}
                            fontWeight={600}
                            color={startingPoint === 'upload' ? '#764ba2' : 'text.primary'}
                          >
                            Review Policy
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Upload existing documents to review & improve
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Upload inputs for Review Policy */}
                  {startingPoint === 'upload' && (
                    <Box sx={{ mt: 2 }}>
                      {/* Function first — it scopes which library policies you can browse for the benchmark */}
                      <FormControl fullWidth required size="small" sx={{ mb: 2 }}>
                        <InputLabel>Function</InputLabel>
                        <Select
                          value={formData.function}
                          onChange={(e) => { handleFunctionChange(e.target.value); setBenchmarkPolicyId(null); }}
                          label="Function"
                          sx={{ backgroundColor: 'background.paper' }}
                        >
                          {functions.map((func) => (
                            <MenuItem key={func} value={func}>{func}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <Grid container spacing={isCompact ? 1.5 : 2}>
                        {/* Current Client Policy */}
                        <Grid item xs={12} md={6}>
                          <input type="file" accept=".docx" ref={currentPolicyRef} style={{ display: 'none' }} onChange={handleCurrentPolicyChange} />
                          <Box
                            onClick={() => currentPolicyRef.current?.click()}
                            sx={{
                              cursor: 'pointer',
                              border: '2px dashed',
                              borderColor: currentPolicyFile ? '#2E7D32' : '#1976D2',
                              borderRadius: 2,
                              p: isCompact ? 1.5 : 2,
                              textAlign: 'center',
                              background: currentPolicyFile ? '#F1F8E9' : '#E3F2FD',
                              transition: 'all 0.2s',
                              '&:hover': { background: currentPolicyFile ? '#DCEDC8' : '#BBDEFB' },
                            }}
                          >
                            <PolicyOutlined sx={{ fontSize: 28, color: currentPolicyFile ? '#2E7D32' : '#1976D2', mb: 0.5 }} />
                            <Typography variant="caption" fontWeight={600} display="block" color={currentPolicyFile ? '#2E7D32' : '#1976D2'}>
                              Current Client Policy *
                            </Typography>
                            {currentPolicyFile ? (
                              <Box display="flex" alignItems="center" justifyContent="center" gap={0.5} mt={0.5}>
                                <CheckCircle sx={{ fontSize: 14, color: '#2E7D32' }} />
                                <Typography variant="caption" color="#2E7D32" noWrap sx={{ maxWidth: 180 }}>{currentPolicyFile.name}</Typography>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">Click to upload .docx</Typography>
                            )}
                          </Box>
                        </Grid>

                        {/* Current Regulations (optional) */}
                        <Grid item xs={12} md={6}>
                          <input type="file" multiple ref={regulationsRef} style={{ display: 'none' }} onChange={handleRegulationsChange} />
                          <Box
                            onClick={() => regulationsRef.current?.click()}
                            sx={{
                              cursor: 'pointer',
                              border: '2px dashed',
                              borderColor: regulationsFiles.length > 0 ? '#4A148C' : '#9E9E9E',
                              borderRadius: 2,
                              p: isCompact ? 1.5 : 2,
                              textAlign: 'center',
                              background: regulationsFiles.length > 0 ? '#F3E5F5' : '#FAFAFA',
                              transition: 'all 0.2s',
                              '&:hover': { background: regulationsFiles.length > 0 ? '#E1BEE7' : '#F5F5F5' },
                            }}
                          >
                            <Gavel sx={{ fontSize: 28, color: regulationsFiles.length > 0 ? '#4A148C' : '#9E9E9E', mb: 0.5 }} />
                            <Typography variant="caption" fontWeight={600} display="block" color={regulationsFiles.length > 0 ? '#4A148C' : 'text.secondary'}>
                              Current Regulations (optional)
                            </Typography>
                            {regulationsFiles.length > 0 ? (
                              <Box display="flex" alignItems="center" justifyContent="center" gap={0.5} mt={0.5}>
                                <CheckCircle sx={{ fontSize: 14, color: '#4A148C' }} />
                                <Typography variant="caption" color="#4A148C">{regulationsFiles.length} file{regulationsFiles.length > 1 ? 's' : ''} selected</Typography>
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">Click to upload files</Typography>
                            )}
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Benchmark Policy — full-width card */}
                      <Box sx={{ mt: 2, p: isCompact ? 1.5 : 2, border: '1px solid #e2e8f0', borderRadius: 2, background: '#fafbff' }}>
                        <Box mb={1}>
                          <Typography variant="caption" fontWeight={600} display="block">Benchmark Policy *</Typography>
                          <Typography variant="caption" color="text.secondary">Good-standard reference for the gap assessment</Typography>
                        </Box>

                        {benchmarkMode === 'upload' ? (
                          <>
                            <input type="file" accept=".docx" ref={benchmarkRef} style={{ display: 'none' }} onChange={handleBenchmarkChange} />
                            <Box
                              onClick={() => benchmarkRef.current?.click()}
                              sx={{
                                cursor: 'pointer',
                                border: '2px dashed',
                                borderColor: benchmarkFile ? '#667eea' : '#e2e8f0',
                                borderRadius: 2,
                                p: isCompact ? 1.5 : 2,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1.5,
                                background: benchmarkFile ? '#f5f3ff' : 'background.paper',
                                transition: 'all 0.2s',
                                '&:hover': { borderColor: '#667eea', background: '#f5f3ff' },
                              }}
                            >
                              <Article sx={{ fontSize: 26, color: benchmarkFile ? '#667eea' : '#9E9E9E', flexShrink: 0 }} />
                              {benchmarkFile ? (
                                <Box display="flex" alignItems="center" gap={0.5}>
                                  <CheckCircle sx={{ fontSize: 14, color: '#667eea' }} />
                                  <Typography variant="caption" color="#667eea" noWrap sx={{ maxWidth: 320 }}>{benchmarkFile.name}</Typography>
                                </Box>
                              ) : (
                                <Typography variant="caption" color="text.secondary">Click to upload a good-standard .docx</Typography>
                              )}
                            </Box>
                          </>
                        ) : (
                          <Autocomplete
                            size="small"
                            fullWidth
                            options={libraryPolicies}
                            loading={loadingLibrary}
                            getOptionLabel={(o) => o.filename || o.policy_id}
                            value={libraryPolicies.find(p => p.policy_id === benchmarkPolicyId) || null}
                            onChange={(_, val) => setBenchmarkPolicyId(val ? val.policy_id : null)}
                            isOptionEqualToValue={(o, v) => o.policy_id === v.policy_id}
                            noOptionsText={loadingLibrary ? 'Loading…' : `No ${formData.function} policies in the library`}
                            renderOption={(props, option) => (
                              <li {...props} key={option.policy_id}>
                                <Box>
                                  <Typography variant="body2" fontWeight={600}>{option.filename}</Typography>
                                  {option.description && (
                                    <Typography variant="caption" color="text.secondary" sx={{
                                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                                    }}>
                                      {option.description}
                                    </Typography>
                                  )}
                                </Box>
                              </li>
                            )}
                            renderInput={(params) => (
                              <TextField
                                {...params}
                                placeholder={`Search ${formData.function} policies in the library…`}
                                InputProps={{
                                  ...params.InputProps,
                                  endAdornment: (
                                    <>
                                      {loadingLibrary ? <CircularProgress size={16} /> : null}
                                      {params.InputProps.endAdornment}
                                    </>
                                  ),
                                }}
                              />
                            )}
                          />
                        )}

                        <Box display="flex" alignItems="center" mt={1}>
                          <FormControlLabel
                            sx={{ m: 0 }}
                            control={
                              <Switch
                                size="small"
                                checked={benchmarkMode === 'browse'}
                                onChange={(e) => {
                                  const browse = e.target.checked;
                                  setBenchmarkMode(browse ? 'browse' : 'upload');
                                  if (browse) setBenchmarkFile(null); else setBenchmarkPolicyId(null);
                                }}
                                sx={{
                                  '& .MuiSwitch-switchBase.Mui-checked': { color: '#667eea' },
                                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#667eea' },
                                }}
                              />
                            }
                            label={
                              <Typography variant="caption" color="text.secondary">
                                {benchmarkMode === 'browse' ? 'Browse from library' : 'Upload a file'}
                              </Typography>
                            }
                          />
                        </Box>

                        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: '1px solid #eef0f6' }}>
                          <Typography variant="caption" fontWeight={600} display="block">Rewrite intensity</Typography>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                            Preserve keeps ≥50-60% of the client's policy. Use Rebuild only for weak/light policies you've agreed to largely rewrite.
                          </Typography>
                          <ToggleButtonGroup
                            size="small"
                            exclusive
                            value={reviewIntensity}
                            onChange={(_, val) => { if (val) setReviewIntensity(val); }}
                            sx={{
                              '& .MuiToggleButton-root.Mui-selected': { color: 'white', backgroundColor: '#667eea', '&:hover': { backgroundColor: '#5a6fd6' } },
                              '& .MuiToggleButton-root': { textTransform: 'none', py: 0.25 },
                            }}
                          >
                            <ToggleButton value="preserve">Preserve</ToggleButton>
                            <ToggleButton value="rebuild">Rebuild</ToggleButton>
                          </ToggleButtonGroup>
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              )}

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
                      InputProps={{
                        sx: { backgroundColor: 'background.paper' }
                      }}
                    />
                  </Grid>

                  {!editDraft && startingPoint === 'ai' && <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      size={isCompact ? 'small' : 'medium'}
                      rows={isCompact ? 2 : 3}
                      label="Policy Description"
                      value={formData.description}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, description: e.target.value }));
                        setDescriptionCheck(null);
                      }}
                      placeholder="Describe the purpose and scope of this policy — used to find similar existing policies"
                      InputProps={{ sx: { backgroundColor: 'background.paper' } }}
                      sx={{
                        '& .MuiOutlinedInput-root': descriptionCheck?.is_valid
                          ? { '& fieldset': { borderColor: '#4caf50', borderWidth: '2px' } }
                          : descriptionCheck && !descriptionCheck.is_valid
                          ? { '& fieldset': { borderColor: '#ff9800', borderWidth: '2px' } }
                          : {},
                      }}
                    />

                    {/* Check button — shown when description has content and not yet checked */}
                    {!editDraft && startingPoint === 'ai' && formData.description?.trim() && !descriptionCheck && (
                      <Box display="flex" justifyContent="flex-end" mt={0.75}>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={handleCheckDescription}
                          disabled={checkingDescription}
                          startIcon={checkingDescription
                            ? <CircularProgress size={13} sx={{ color: '#667eea' }} />
                            : <CheckCircleOutline sx={{ fontSize: 15 }} />}
                          sx={{
                            borderColor: '#667eea',
                            color: '#667eea',
                            fontSize: '0.75rem',
                            textTransform: 'none',
                            '&:hover': { borderColor: '#764ba2', color: '#764ba2', background: '#f5f3ff' },
                          }}
                        >
                          {checkingDescription ? 'Checking…' : 'Check Description'}
                        </Button>
                      </Box>
                    )}

                    {/* Pass state */}
                    {descriptionCheck?.is_valid && (
                      <Box display="flex" alignItems="center" gap={0.5} mt={0.75}>
                        <CheckCircle sx={{ fontSize: 16, color: '#4caf50' }} />
                        <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 600 }}>
                          Description looks good (score: {descriptionCheck.score}/100)
                        </Typography>
                      </Box>
                    )}

                    {/* Fail state */}
                    {descriptionCheck && !descriptionCheck.is_valid && (
                      <Box sx={{
                        mt: 1,
                        p: 1.5,
                        borderRadius: 2,
                        border: '1px solid #ff9800',
                        background: '#fffbf0',
                      }}>
                        <Box display="flex" alignItems="center" justifyContent="space-between" mb={0.5}>
                          <Typography variant="caption" fontWeight={700} sx={{ color: '#e65100' }}>
                            Description needs improvement (score: {descriptionCheck.score}/100)
                          </Typography>
                        </Box>
                        {descriptionCheck.issues.map((issue, i) => (
                          <Typography key={i} variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
                            • {issue}
                          </Typography>
                        ))}
                        {descriptionCheck.improved_description && (
                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleImproveDescription}
                            startIcon={<AutoAwesome sx={{ fontSize: 14 }} />}
                            sx={{
                              mt: 1,
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              color: '#fff',
                              fontSize: '0.75rem',
                              textTransform: 'none',
                              boxShadow: 'none',
                              '&:hover': { boxShadow: '0 4px 12px rgba(102,126,234,0.35)' },
                            }}
                          >
                            Improve with AI
                          </Button>
                        )}
                      </Box>
                    )}
                  </Grid>}

                  {startingPoint !== 'upload' && (
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth required size={isCompact ? 'small' : 'medium'}>
                        <InputLabel>Function</InputLabel>
                        <Select
                          value={formData.function}
                          onChange={(e) => handleFunctionChange(e.target.value)}
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
                  )}

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
                        <MenuItem value="None">None</MenuItem>
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
              {startingPoint === 'upload'
                ? 'After uploading, the tool extracts the TOC and content from your document. You can then:'
                : 'After creating your draft, you\'ll be able to:'}
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
      {/* Policy selection dialog */}
      <Dialog
        open={similarPolicies.length > 0}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle>
          Similar Policies Found
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            We found {similarPolicies.length} similar {similarPolicies.length === 1 ? 'policy' : 'policies'} in the library.
            Choose one to use as the starting structure for your draft, or generate a new TOC with AI.
          </Typography>
          <Grid container spacing={2}>
            {similarPolicies.map((policy) => (
              <Grid item xs={12} key={policy.policy_id}>
                <Card variant="outlined">
                  <CardContent sx={{ pb: 1 }}>
                    <Box display="flex" alignItems="center" gap={1} mb={0.75} flexWrap="wrap">
                      <Article sx={{ color: '#667eea', fontSize: 18 }} />
                      <Typography variant="subtitle2" fontWeight={600}>
                        {policy.filename}
                      </Typography>
                      {policy.web_url && (
                        <Typography
                          component="a"
                          href={policy.web_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          variant="caption"
                          sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.25,
                            px: 0.9,
                            py: 0.15,
                            borderRadius: '999px',
                            backgroundColor: '#f5f3ff',
                            border: '1px solid #ddd6fe',
                            color: '#667eea',
                            fontWeight: 600,
                            lineHeight: 1.6,
                            textDecoration: 'none',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              backgroundColor: '#667eea',
                              borderColor: '#667eea',
                              color: '#fff',
                            },
                          }}
                        >
                          SharePoint ↗
                        </Typography>
                      )}
                      <Chip
                        label={`${Math.round(policy.similarity_score * 100)}% match`}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ ml: 'auto' }}
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}>
                      {policy.description}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ pt: 0 }}>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={applyingId !== null}
                      onClick={() => handleApplyPolicy(policy.policy_id)}
                    >
                      {applyingId === policy.policy_id ? <CircularProgress size={16} /> : 'Use this policy'}
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            variant="contained"
            startIcon={applyingId === '__ai__' ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
            disabled={applyingId !== null}
            onClick={() => handleApplyPolicy(null)}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              textTransform: 'none',
              fontWeight: 600,
              px: 2.5,
              boxShadow: 'none',
              '&:hover': { boxShadow: '0 6px 16px rgba(102,126,234,0.35)' },
              '&.Mui-disabled': { background: '#c7c7d9', color: '#fff' },
            }}
          >
            {applyingId === '__ai__' ? 'Generating...' : 'Generate with AI instead'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default NewDraftPage;