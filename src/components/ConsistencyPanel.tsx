import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Rule, CheckCircle, AutoAwesome } from '@mui/icons-material';
import { draftService } from '../services/draftService';
import { ConsistencyReport } from '../types/draft.types';

interface ConsistencyPanelProps {
  draftId: string;
  open: boolean;
  onClose: () => void;
  initialReportJson?: string | null;
}

const PURPLE_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

const SEVERITY_COLOR: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#10b981' };

const TYPE_LABEL: Record<string, string> = {
  contradiction: 'Contradiction',
  terminology: 'Terminology',
  duplicate: 'Duplicate',
  undefined_term: 'Undefined term',
  cross_reference: 'Cross-reference',
};

function parse(json?: string | null): ConsistencyReport | null {
  if (!json) return null;
  try { return JSON.parse(json) as ConsistencyReport; } catch { return null; }
}

const ConsistencyPanel: React.FC<ConsistencyPanelProps> = ({ draftId, open, onClose, initialReportJson }) => {
  const [report, setReport] = useState<ConsistencyReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReport(parse(initialReportJson));
      setError(null);
    }
  }, [open, initialReportJson]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    try {
      setReport(await draftService.runConsistencyCheck(draftId));
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Consistency check failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 700 }}>
        <Rule sx={{ color: '#667eea' }} /> Whole-policy consistency
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

        {!report ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Check the whole policy for contradictions, inconsistent terminology, duplicate clauses,
              undefined terms, and broken cross-references.
            </Typography>
            <Button
              variant="contained"
              startIcon={running ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
              disabled={running}
              onClick={handleRun}
              sx={{ background: PURPLE_GRADIENT, textTransform: 'none', fontWeight: 600, color: '#fff', '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)', background: PURPLE_GRADIENT } }}
            >
              {running ? 'Checking…' : 'Run consistency check'}
            </Button>
          </Box>
        ) : (
          <>
            {report.summary && <Alert severity="info" sx={{ mb: 2 }}>{report.summary}</Alert>}
            {report.issues.length === 0 ? (
              <Box display="flex" alignItems="center" gap={1} sx={{ color: '#059669' }}>
                <CheckCircle sx={{ fontSize: 18 }} />
                <Typography variant="body2" fontWeight={600}>No consistency issues found.</Typography>
              </Box>
            ) : (
              report.issues.map((iss) => (
                <Box key={iss.id} sx={{ p: 1.5, mb: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Box display="flex" alignItems="center" gap={0.5} mb={0.5} flexWrap="wrap">
                    <Chip label={TYPE_LABEL[iss.type] || iss.type} size="small"
                      sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, color: '#667eea', backgroundColor: '#f5f3ff' }} />
                    <Chip label={iss.severity} size="small"
                      sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, textTransform: 'capitalize', color: 'white', backgroundColor: SEVERITY_COLOR[iss.severity] || '#64748b' }} />
                    {iss.locations.map((loc, i) => (
                      <Chip key={i} label={loc} size="small"
                        sx={{ height: 20, fontSize: '0.6rem', color: '#475569', backgroundColor: '#f1f5f9' }} />
                    ))}
                  </Box>
                  <Typography variant="body2" sx={{ color: '#2d3748' }}>{iss.description}</Typography>
                  {iss.suggestion && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Suggestion: {iss.suggestion}
                    </Typography>
                  )}
                </Box>
              ))
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Close</Button>
        {report && (
          <Button
            variant="outlined"
            startIcon={running ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
            disabled={running}
            onClick={handleRun}
            sx={{ textTransform: 'none', borderColor: '#667eea', color: '#667eea' }}
          >
            {running ? 'Re-checking…' : 'Re-run'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ConsistencyPanel;
