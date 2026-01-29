import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  CircularProgress,
  Alert,
  Container,
  IconButton,
  Tooltip,
  Avatar,
  Paper,
  InputBase,
  Divider,
  Drawer,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Autocomplete,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  GetApp,
  AccessTime,
  LocationOn,
  Business,
  Search,
  FilterList,
  FolderOpen,
  CalendarToday,
  Close,
  Work,
  Description as DescriptionIcon,
  Public,
  Apartment,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { Country, State } from 'country-state-city';
import { draftService } from '../services/draftService';
import { DraftSummary } from '../types/draft.types';

// Industry options (same as NewDraftPage)
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

const DraftsPage: React.FC = () => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter and search state
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  // Static list of functions
  const functions = ['HR', 'IT', 'Legal', 'Finance', 'Operations'];
  const [filters, setFilters] = useState<{
    title?: string;
    country?: string;
    city?: string;
    created_by?: string;
    industry?: string;
    function?: string;
  }>({});

  // Temporary filters for the drawer (only applied when clicking Apply)
  const [tempFilters, setTempFilters] = useState<typeof filters>({});

  // Track if initial load has completed to prevent duplicate calls
  const initialLoadDone = React.useRef(false);

  // Get all countries (filter out Israel)
  const countries = Country.getAllCountries().filter(country => country.isoCode !== 'IL');

  useEffect(() => {
    // Load initial data on mount only once
    loadDrafts();
    initialLoadDone.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Debounce search - only update filters if there's an actual change
    const timer = setTimeout(() => {
      setFilters(prev => {
        if (searchQuery) {
          // Only update if title is different
          if (prev.title !== searchQuery) {
            return { ...prev, title: searchQuery };
          }
        } else {
          // Only update if title exists and needs to be removed
          if (prev.title) {
            const { title, ...rest } = prev;
            return rest;
          }
        }
        // No change needed, return same object to avoid re-render
        return prev;
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    // Skip the initial mount since we load drafts in the first useEffect
    if (!initialLoadDone.current) {
      return;
    }

    // Reload drafts whenever filters change after initial mount
    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Functions list is now static - no need to fetch from backend

  const loadDrafts = async (filtersToUse?: typeof filters) => {
    setLoading(true);
    setError(null);
    try {
      // Use provided filters or fall back to state filters
      const activeFilters = filtersToUse !== undefined ? filtersToUse : filters;
      const response = await draftService.getDrafts(activeFilters);
      setDrafts(response?.drafts || []);
    } catch (err) {
      setError('Failed to load drafts. Please try again.');
      console.error('Error loading drafts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this draft?')) {
      try {
        await draftService.deleteDraft(id);
        await loadDrafts();
      } catch (err) {
        console.error('Error deleting draft:', err);
        alert('Failed to delete draft. Please try again.');
      }
    }
  };

  const handleExportToWord = async (draftId: string, draftTitle: string) => {
    try {
      const blob = await draftService.exportToWord(draftId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${draftTitle.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting to Word:', err);
      alert('Failed to export to Word. Please try again.');
    }
  };

  const handleOpenFilters = () => {
    // Copy current filters to temp filters when opening drawer
    setTempFilters(filters);
    setShowFilters(true);
  };

  const handleApplyFilters = async () => {
    // Apply the temp filters to actual filters
    setFilters(tempFilters);
    setShowFilters(false);
    // Load drafts immediately with the new filters
    await loadDrafts(tempFilters);
  };

  const handleClearFilters = async () => {
    setTempFilters({});
    setFilters({});
    setSearchQuery('');
    setShowFilters(false);
    // Load all drafts without filters
    await loadDrafts({});
  };

  const handleRemoveFilter = (key: keyof typeof filters) => {
    setFilters(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return formatDate(dateString);
  };

  const activeFilterCount = Object.keys(filters).length;

  if (loading && drafts.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button onClick={() => loadDrafts()}>Retry</Button>
      </Box>
    );
  }

  return (
    <Container maxWidth="xl">
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box>
            <Typography variant="h4" fontWeight={600} gutterBottom>
              Policy Drafts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage and track your policy documents
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            startIcon={<Add />}
            onClick={() => navigate('/drafts/new')}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              px: 3,
            }}
          >
            New Draft
          </Button>
        </Box>

        {/* Search and Filter Bar */}
        <Paper
          elevation={0}
          sx={{
            p: 1,
            display: 'flex',
            alignItems: 'center',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <IconButton sx={{ p: 1 }}>
            <Search />
          </IconButton>
          <InputBase
            sx={{ ml: 1, flex: 1 }}
            placeholder="Search drafts by title..."
            inputProps={{ 'aria-label': 'search drafts' }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
          <Tooltip title="Filters">
            <IconButton sx={{ p: 1 }} onClick={handleOpenFilters}>
              <FilterList />
              {activeFilterCount > 0 && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'primary.main',
                    color: 'white',
                    borderRadius: '50%',
                    width: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                  }}
                >
                  {activeFilterCount}
                </Box>
              )}
            </IconButton>
          </Tooltip>
        </Paper>

        {/* Active Filters */}
        {activeFilterCount > 0 && (
          <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Object.entries(filters).map(([key, value]) => (
              <Chip
                key={key}
                label={`${key}: ${value}`}
                onDelete={() => handleRemoveFilter(key as keyof typeof filters)}
                size="small"
                sx={{ textTransform: 'capitalize' }}
              />
            ))}
            <Button
              size="small"
              onClick={handleClearFilters}
              sx={{ textTransform: 'none', minWidth: 'auto' }}
            >
              Clear All
            </Button>
          </Box>
        )}
      </Box>

      {/* Filter Drawer */}
      <Drawer
        anchor="right"
        open={showFilters}
        onClose={() => setShowFilters(false)}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 400 }, p: 3 }
        }}
      >
        <Box>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h6" fontWeight={600}>
              Filter Drafts
            </Typography>
            <IconButton onClick={() => setShowFilters(false)}>
              <Close />
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Country Filter */}
            <Autocomplete
              options={countries}
              getOptionLabel={(option) => option.name}
              value={countries.find(c => c.name === tempFilters.country) || null}
              onChange={(_, newValue) => {
                setTempFilters(prev => ({
                  ...prev,
                  country: newValue?.name || undefined,
                  city: undefined // Reset city when country changes
                }));
              }}
              renderInput={(params) => <TextField {...params} label="Country" />}
            />

            {/* City Filter */}
            {tempFilters.country && (
              <Autocomplete
                options={State.getStatesOfCountry(
                  countries.find(c => c.name === tempFilters.country)?.isoCode || ''
                )}
                getOptionLabel={(option) => option.name}
                value={
                  State.getStatesOfCountry(
                    countries.find(c => c.name === tempFilters.country)?.isoCode || ''
                  ).find(s => s.name === tempFilters.city) || null
                }
                onChange={(_, newValue) => {
                  setTempFilters(prev => ({
                    ...prev,
                    city: newValue?.name || undefined
                  }));
                }}
                renderInput={(params) => <TextField {...params} label="City/State" />}
              />
            )}

            {/* Created By Filter */}
            <TextField
              label="Created By"
              value={tempFilters.created_by || ''}
              onChange={(e) => setTempFilters(prev => ({ ...prev, created_by: e.target.value || undefined }))}
              placeholder="Enter user email or name"
            />

            {/* Industry Filter */}
            <FormControl fullWidth>
              <InputLabel>Industry</InputLabel>
              <Select
                value={tempFilters.industry || ''}
                onChange={(e) => setTempFilters(prev => ({ ...prev, industry: e.target.value || undefined }))}
                label="Industry"
              >
                <MenuItem value="">
                  <em>All Industries</em>
                </MenuItem>
                {INDUSTRY_OPTIONS.map((industry) => (
                  <MenuItem key={industry} value={industry}>
                    {industry}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Function Filter */}
            <FormControl fullWidth>
              <InputLabel>Function</InputLabel>
              <Select
                value={tempFilters.function || ''}
                onChange={(e) => {
                  const funcValue = e.target.value || undefined;
                  setTempFilters(prev => ({
                    ...prev,
                    function: funcValue
                  }));
                }}
                label="Function"
              >
                <MenuItem value="">
                  <em>All Functions</em>
                </MenuItem>
                {functions.map((func) => (
                  <MenuItem key={func} value={func}>
                    {func}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ mt: 4, display: 'flex', gap: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={handleClearFilters}
            >
              Clear All
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={handleApplyFilters}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              }}
            >
              Apply
            </Button>
          </Box>
        </Box>
      </Drawer>

      {drafts.length === 0 ? (
        <Paper
          elevation={0}
          sx={{
            p: 6,
            textAlign: 'center',
            border: '2px dashed',
            borderColor: 'divider',
            borderRadius: 2,
            bgcolor: 'background.default',
          }}
        >
          <FolderOpen sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            {activeFilterCount > 0 ? 'No drafts match your filters' : 'No drafts yet'}
          </Typography>
          <Typography color="text.secondary" gutterBottom>
            {activeFilterCount > 0 ? 'Try adjusting your search or filters' : 'Create your first policy draft to get started'}
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/drafts/new')}
            sx={{
              mt: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            }}
          >
            Create First Draft
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {drafts.map((draft) => (
              <Grid item xs={12} sm={6} md={6} lg={6} key={draft.draft_id}>
                <Paper
                  elevation={0}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 4,
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#ffffff',
                    border: '2px solid #e2e8f0',
                    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'translateY(-12px)',
                      boxShadow: '0 28px 56px rgba(102, 126, 234, 0.18), 0 12px 24px rgba(102, 126, 234, 0.1)',
                      border: '2px solid rgba(102, 126, 234, 0.3)',
                      '& .action-section': {
                        transform: 'translateY(0)',
                        opacity: 1,
                      },
                    },
                  }}
                  onClick={() => navigate(`/drafts/${draft.draft_id}`)}
                >
                  {/* Card Header */}
                  <Box
                    className="card-header"
                    sx={{
                      p: 3,
                      pb: 2,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: '16px 16px 0 0',
                      transition: 'all 0.4s ease',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                      <Typography
                        className="card-title"
                        variant="h5"
                        fontWeight={700}
                        sx={{
                          color: 'white',
                          fontSize: '1.35rem',
                          lineHeight: 1.3,
                          flex: 1,
                          pr: 2,
                          transition: 'color 0.4s ease',
                        }}
                      >
                        {draft.title}
                      </Typography>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: '#10b981',
                          flexShrink: 0,
                          mt: 1,
                        }}
                      />
                    </Box>
                  </Box>

                  {/* Card Content */}
                  <Box sx={{
                    flexGrow: 1,
                    p: 3,
                    pt: 4.5,
                    backgroundColor: '#f8f9fa',
                  }}>

                    {/* Policy Details Section */}
                    <Box
                      sx={{
                        mb: 4.5,
                        p: 2.5,
                        pt: 3.5,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                        border: '2px solid',
                        borderColor: 'rgba(102, 126, 234, 0.4)',
                        position: 'relative',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{
                          position: 'absolute',
                          top: -26,
                          left: -4,
                          px: 1.5,
                          py: 0,
                          // bgcolor: '#f8f9fa',
                          color: 'rgb(102, 126, 234)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.8,
                          fontSize: '0.95rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}
                      >
                        📋 Policy Details
                      </Typography>

                      <Box mb={2}>
                        {/* Function */}
                        {draft.function && (
                          <Box>
                            <Box display="flex" alignItems="center" gap={0.8} mb={0.5}>
                              <Work sx={{ fontSize: 14, color: 'rgb(102, 126, 234)' }} />
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'rgb(160, 174, 192)',
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                }}
                              >
                                Function
                              </Typography>
                            </Box>
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#000000',
                                fontSize: '0.75rem',
                                pl: 2.8,
                              }}
                            >
                              {draft.function}
                            </Typography>
                          </Box>
                        )}
                      </Box>

                      <Divider sx={{ my: 2, borderColor: 'rgba(102, 126, 234, 0.15)' }} />

                      {/* Time & Author Grid */}
                      <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr 1fr' }} gap={2}>
                        {/* Created */}
                        <Box>
                          <Box display="flex" alignItems="center" gap={0.8} mb={0.5}>
                            <CalendarToday sx={{ fontSize: 14, color: 'rgb(102, 126, 234)' }} />
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'rgb(160, 174, 192)',
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                              }}
                            >
                              Created
                            </Typography>
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              color: '#000000',
                              fontSize: '0.7rem',
                              pl: 2.8,
                            }}
                          >
                            {formatDate(draft.created_at)}
                          </Typography>
                        </Box>

                        {/* Updated */}
                        <Box>
                          <Box display="flex" alignItems="center" gap={0.8} mb={0.5}>
                            <AccessTime sx={{ fontSize: 14, color: 'rgb(102, 126, 234)' }} />
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'rgb(160, 174, 192)',
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                              }}
                            >
                              Updated
                            </Typography>
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              color: '#000000',
                              fontSize: '0.7rem',
                              pl: 2.8,
                            }}
                          >
                            {getTimeAgo(draft.modified_at)}
                          </Typography>
                        </Box>

                        {/* Created By */}
                        <Box>
                          <Box display="flex" alignItems="center" gap={0.8} mb={0.5}>
                            <Avatar
                              sx={{
                                width: 14,
                                height: 14,
                                fontSize: '0.6rem',
                                backgroundColor: 'rgb(102, 126, 234)',
                              }}
                            >
                              {(draft.created_by || 'U')[0].toUpperCase()}
                            </Avatar>
                            <Typography
                              variant="caption"
                              sx={{
                                color: 'rgb(160, 174, 192)',
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                textTransform: 'uppercase',
                              }}
                            >
                              Author
                            </Typography>
                          </Box>
                          <Typography
                            variant="body2"
                            sx={{
                              color: '#000000',
                              fontSize: '0.7rem',
                              pl: 2.8,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={draft.created_by || 'Unknown User'}
                          >
                            {draft.created_by || 'Unknown'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>

                    {/* Client Information Section */}
                    {draft.client_metadata && (
                      <Box
                        sx={{
                          p: 2.5,
                          pt: 3.5,
                          borderRadius: 2,
                          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                          border: '2px solid',
                          borderColor: 'rgba(102, 126, 234, 0.4)',
                          position: 'relative',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.15)',
                        }}
                      >
                        <Typography
                          variant="h6"
                          sx={{
                            position: 'absolute',
                            top: -26,
                            left: -4,
                            px: 1.5,
                            py: 0,
                            // bgcolor: '#f8f9fa',
                            color: 'rgb(102, 126, 234)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.8,
                            fontSize: '0.95rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                          }}
                        >
                          🏢 Client Information
                        </Typography>

                        {/* Client Name & Industry */}
                        <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2} mb={2}>
                          {/* Client Name */}
                          <Box>
                            <Box display="flex" alignItems="center" gap={0.8} mb={0.5}>
                              <Business sx={{ fontSize: 14, color: 'rgb(102, 126, 234)' }} />
                              <Typography
                                variant="caption"
                                sx={{
                                  color: 'rgb(160, 174, 192)',
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  textTransform: 'uppercase',
                                }}
                              >
                                Client
                              </Typography>
                            </Box>
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#000000',
                                fontSize: '0.75rem',
                                pl: 2.8,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={draft.client_metadata.name}
                            >
                              {draft.client_metadata.name}
                            </Typography>
                          </Box>

                          {/* Industry */}
                          {draft.client_metadata.industry && (
                            <Box>
                              <Box display="flex" alignItems="center" gap={0.8} mb={0.5}>
                                <Business sx={{ fontSize: 14, color: 'rgb(102, 126, 234)' }} />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'rgb(160, 174, 192)',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Industry
                                </Typography>
                              </Box>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: '#000000',
                                  fontSize: '0.75rem',
                                  pl: 2.8,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={draft.client_metadata.industry}
                              >
                                {draft.client_metadata.industry}
                              </Typography>
                            </Box>
                          )}
                        </Box>

                        {/* Country & City Grid */}
                        <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2}>
                          {/* Country */}
                          {draft.client_metadata.country && (
                            <Box>
                              <Box display="flex" alignItems="center" gap={0.8} mb={0.5}>
                                <Public sx={{ fontSize: 14, color: 'rgb(102, 126, 234)' }} />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'rgb(160, 174, 192)',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Country
                                </Typography>
                              </Box>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: '#000000',
                                  fontSize: '0.7rem',
                                  pl: 2.8,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={draft.client_metadata.country}
                              >
                                {draft.client_metadata.country}
                              </Typography>
                            </Box>
                          )}

                          {/* City */}
                          {draft.client_metadata.city && (
                            <Box>
                              <Box display="flex" alignItems="center" gap={0.8} mb={0.5}>
                                <Apartment sx={{ fontSize: 14, color: 'rgb(102, 126, 234)' }} />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: 'rgb(102, 126, 234)',
                                    fontSize: '0.65rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  City
                                </Typography>
                              </Box>
                              <Typography
                                variant="body2"
                                sx={{
                                  color: '#000000',
                                  fontSize: '0.7rem',
                                  pl: 2.8,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={draft.client_metadata.city}
                              >
                                {draft.client_metadata.city}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )}
                  </Box>

                  {/* Action Section */}
                  <Box
                    className="action-section"
                    sx={{
                      p: 3,
                      pt: 0,
                      transition: 'all 0.4s ease',
                    }}
                  >
                    <Box display="flex" gap={1.5} justifyContent="center" alignItems="stretch">
                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<Edit sx={{ fontSize: 16 }} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/drafts/${draft.draft_id}`);
                        }}
                        sx={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          textTransform: 'none',
                          px: 3,
                          py: 1.2,
                          borderRadius: 3,
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                          flex: '1 1 60%',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #5569d8 0%, #6a4291 100%)',
                            transform: 'translateY(-2px)',
                            boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                          },
                        }}
                      >
                        Open Draft
                      </Button>
                      <Tooltip title="Export to Word" arrow>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportToWord(draft.draft_id, draft.title);
                          }}
                          sx={{
                            bgcolor: '#f7fafc',
                            border: '2px solid #e2e8f0',
                            borderRadius: 2,
                            color: '#667eea',
                            width: 44,
                            height: 44,
                            '&:hover': {
                              bgcolor: 'rgba(102, 126, 234, 0.1)',
                              borderColor: '#667eea',
                              transform: 'translateY(-2px)',
                            },
                          }}
                        >
                          <GetApp sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete Draft" arrow>
                        <IconButton
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(draft.draft_id);
                          }}
                          sx={{
                            bgcolor: '#fef2f2',
                            border: '2px solid #fecaca',
                            borderRadius: 2,
                            color: '#ef4444',
                            width: 44,
                            height: 44,
                            '&:hover': {
                              bgcolor: '#fee2e2',
                              borderColor: '#f87171',
                              transform: 'translateY(-2px)',
                            },
                          }}
                        >
                          <Delete sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                </Paper>
              </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default DraftsPage;
