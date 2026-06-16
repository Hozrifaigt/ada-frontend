import React, { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  CircularProgress,
  Alert,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { History as HistoryIcon, Restore, Save, Person } from '@mui/icons-material';
import { draftService } from '../services/draftService';
import { DraftVersion, AuditEntry } from '../types/draft.types';

interface HistoryPanelProps {
  draftId: string;
  onRestored: () => void;
}

const PURPLE_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

const ACTION_LABEL: Record<string, string> = {
  created: 'Created',
  gap_applied: 'Gap change applied',
  exported: 'Exported',
  version_saved: 'Version saved',
  version_restored: 'Version restored',
  bulk_assessed: 'Bulk assessed',
  toc_updated: 'TOC updated',
};

function fmt(ts: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  return isNaN(d.getTime()) ? ts : d.toLocaleString();
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ draftId, onRestored }) => {
  const [versions, setVersions] = useState<DraftVersion[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [label, setLabel] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<DraftVersion | null>(null);
  const [restoring, setRestoring] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [v, a] = await Promise.all([
        draftService.listVersions(draftId),
        draftService.listAudit(draftId),
      ]);
      setVersions(v);
      setAudit(a);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  }, [draftId]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await draftService.saveVersion(draftId, label.trim() || 'manual');
      setLabel('');
      await load();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to save version.');
    } finally {
      setSaving(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    setError(null);
    try {
      await draftService.restoreVersion(draftId, restoreTarget.version_id);
      setRestoreTarget(null);
      await load();
      onRestored();
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to restore version.');
    } finally {
      setRestoring(false);
    }
  };

  if (loading) {
    return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
      {error && <Alert severity="error" sx={{ width: '100%' }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Versions */}
      <Paper elevation={0} sx={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 1.5, px: 2, background: PURPLE_GRADIENT, color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <HistoryIcon sx={{ fontSize: 18 }} />
          <Typography variant="body1" fontWeight={600} sx={{ flex: 1 }}>Versions</Typography>
        </Box>
        <Box sx={{ p: 2, display: 'flex', gap: 1, borderBottom: '1px solid #e2e8f0' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Label (e.g. 'after client review')"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <Save />}
            disabled={saving}
            onClick={handleSave}
            sx={{ background: PURPLE_GRADIENT, textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap', color: '#fff', '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)', background: PURPLE_GRADIENT } }}
          >
            Save version
          </Button>
        </Box>
        <Box sx={{ p: 1.5, maxHeight: 460, overflow: 'auto' }}>
          {versions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No versions yet.</Typography>
          ) : (
            versions.map((v) => (
              <Paper key={v.version_id} elevation={0} sx={{ p: 1.5, mb: 1, border: '1px solid #e2e8f0', borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box display="flex" alignItems="center" gap={0.75} flexWrap="wrap">
                    <Typography variant="body2" fontWeight={600}>{v.label || 'version'}</Typography>
                    {v.label === 'original' && (
                      <Chip label="original" size="small" sx={{ height: 18, fontSize: '0.6rem', color: '#764ba2', backgroundColor: '#faf5ff' }} />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {fmt(v.created_at)}{v.created_by ? ` · ${v.created_by}` : ''}
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Restore sx={{ fontSize: 16 }} />}
                  onClick={() => setRestoreTarget(v)}
                  sx={{ textTransform: 'none', borderColor: '#667eea', color: '#667eea' }}
                >
                  Restore
                </Button>
              </Paper>
            ))
          )}
        </Box>
      </Paper>

      {/* Audit trail */}
      <Paper elevation={0} sx={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <Box sx={{ p: 1.5, px: 2, background: '#334155', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Person sx={{ fontSize: 18 }} />
          <Typography variant="body1" fontWeight={600} sx={{ flex: 1 }}>Activity</Typography>
        </Box>
        <Box sx={{ p: 1.5, maxHeight: 520, overflow: 'auto' }}>
          {audit.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>No activity yet.</Typography>
          ) : (
            audit.map((a, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1.5, py: 1, borderBottom: i < audit.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#667eea', mt: 0.75, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {ACTION_LABEL[a.action] || a.action}
                    {a.summary ? <Typography component="span" variant="body2" color="text.secondary"> — {a.summary}</Typography> : null}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {fmt(a.ts)}{a.actor ? ` · ${a.actor}` : ''}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Paper>

      {/* Restore confirm */}
      <Dialog open={!!restoreTarget} onClose={() => setRestoreTarget(null)}>
        <DialogTitle>Restore this version?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This replaces the current draft with <strong>{restoreTarget?.label || 'this version'}</strong> from {fmt(restoreTarget?.created_at || '')}.
            Your current state is snapshotted first, so you can undo by restoring it back.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRestoreTarget(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={restoring ? <CircularProgress size={16} color="inherit" /> : <Restore />}
            disabled={restoring}
            onClick={handleRestore}
            sx={{ background: PURPLE_GRADIENT, textTransform: 'none', fontWeight: 600, color: '#fff', '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)', background: PURPLE_GRADIENT } }}
          >
            Restore
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default HistoryPanel;
