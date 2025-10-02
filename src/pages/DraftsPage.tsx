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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { draftService } from '../services/draftService';
import { DraftSummary } from '../types/draft.types';

const DraftsPage: React.FC = () => {
  const navigate = useNavigate();
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDrafts();
  }, []);

  const loadDrafts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await draftService.getDrafts();
      setDrafts(response.drafts);
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

  if (loading) {
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
        <Button onClick={loadDrafts}>Retry</Button>
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
            placeholder="Search drafts..."
            inputProps={{ 'aria-label': 'search drafts' }}
          />
          <Divider sx={{ height: 28, m: 0.5 }} orientation="vertical" />
          <IconButton sx={{ p: 1 }}>
            <FilterList />
          </IconButton>
        </Paper>
      </Box>
      
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
            No drafts yet
          </Typography>
          <Typography color="text.secondary" gutterBottom>
            Create your first policy draft to get started
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
          {drafts.map((draft) => {
            console.log('Draft details:', draft);
            return (
              <Grid item xs={12} md={6} lg={4} key={draft.draft_id}>
                <Paper
                  elevation={0}
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 4,
                    position: 'relative',
                    overflow: 'hidden',
                    background: '#fafbfc',
                    border: '2px solid transparent',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.03)',
                    transition: 'all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'translateY(-12px)',
                      boxShadow: '0 28px 56px rgba(102, 126, 234, 0.18), 0 12px 24px rgba(102, 126, 234, 0.1)',
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
                      color: 'white',
                      transition: 'all 0.4s ease',
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography
                        className="card-title"
                        variant="h5"
                        fontWeight={700}
                        sx={{
                          color: 'white',
                          fontSize: '1.4rem',
                          lineHeight: 1.2,
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
                  <Box sx={{ flexGrow: 1, p: 3, pt: 2 }}>

                    {/* Description */}
                    <Typography
                      variant="body1"
                      sx={{
                        mb: 3,
                        color: '#4a5568',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.7,
                        minHeight: '3.4rem',
                        fontSize: '0.95rem',
                        fontWeight: 400,
                      }}
                    >
                      {draft.description || 'No description available for this draft.'}
                    </Typography>

                    {/* Client Info */}
                    {draft.client_metadata && (
                      <Box
                        sx={
                          {
                          p: 2,
                          borderRadius: 3,
                          background: '#f7fafc',
                          border: '1px solid #e2e8f0',
                          mb: 3,
                          position: 'relative',
                          overflow: 'hidden',
                          '&::before': {
                            content: '""',
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: '4px',
                            background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
                          },
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={2} pl={1}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 3,
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <Business sx={{ fontSize: 20, color: 'white' }} />
                          </Box>
                          <Box>
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              sx={{ color: '#1a202c', mb: 0.5, fontSize: '0.9rem' }}
                            >
                              {draft.client_metadata.name}
                            </Typography>
                            {draft.client_metadata.industry && (
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#667eea',
                                  fontWeight: 600,
                                  fontSize: '0.75rem',
                                  display: 'block',
                                  mb: 0.5,
                                }}
                              >
                                {draft.client_metadata.industry}
                              </Typography>
                            )}
                            <Box display="flex" alignItems="center" gap={0.5}>
                              <LocationOn sx={{ fontSize: 16, color: '#667eea' }} />
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#718096',
                                  fontWeight: 500,
                                  fontSize: '0.8rem',
                                }}
                              >
                                {draft.client_metadata.city}, {draft.client_metadata.country}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    )}

                    {/* Metadata Section */}
                    <Box sx={{ mt: 'auto', pt: 2 }}>
                      {/* Time Info Row */}
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{
                          mb: 2,
                          p: 2,
                          borderRadius: 2,
                          bgcolor: '#fafbfc',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <Box display="flex" alignItems="center" gap={1}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 2,
                              bgcolor: 'rgba(102, 126, 234, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <CalendarToday sx={{ fontSize: 16, color: '#667eea' }} />
                          </Box>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#a0aec0',
                                display: 'block',
                                fontSize: '0.7rem',
                                fontWeight: 500,
                              }}
                            >
                              CREATED
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#2d3748',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                              }}
                            >
                              {formatDate(draft.created_at)}
                            </Typography>
                          </Box>
                        </Box>

                        <Box display="flex" alignItems="center" gap={1}>
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: 2,
                              bgcolor: 'rgba(16, 185, 129, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <AccessTime sx={{ fontSize: 16, color: '#10b981' }} />
                          </Box>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#a0aec0',
                                display: 'block',
                                fontSize: '0.7rem',
                                fontWeight: 500,
                              }}
                            >
                              UPDATED
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#2d3748',
                                fontWeight: 600,
                                fontSize: '0.85rem',
                              }}
                            >
                              {getTimeAgo(draft.modified_at)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>

                      {/* Author Section */}
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Box display="flex" alignItems="center" gap={2}>
                          <Avatar
                            sx={{
                              width: 36,
                              height: 36,
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              fontSize: '1rem',
                              fontWeight: 600,
                            }}
                          >
                            {(draft.created_by || 'U')[0].toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#a0aec0',
                                display: 'block',
                                fontSize: '0.7rem',
                                fontWeight: 500,
                                textTransform: 'uppercase',
                              }}
                            >
                              Created by
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: '#2d3748',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                              }}
                            >
                              {draft.created_by || 'Unknown User'}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>

                  {/* Action Section */}
                  <Box
                    className="action-section"
                    sx={{
                      p: 3,
                      pt: 0,
                      transform: 'translateY(10px)',
                      opacity: 0.7,
                      transition: 'all 0.4s ease',
                    }}
                  >
                    <Box display="flex" gap={1.5} justifyContent="center">
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
                          py: 1,
                          borderRadius: 3,
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
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
                            width: 40,
                            height: 40,
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
                            width: 40,
                            height: 40,
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
          );
          })}
        </Grid>
      )}
    </Container>
  );
};

export default DraftsPage;