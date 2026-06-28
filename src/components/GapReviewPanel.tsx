import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Checkbox,
  TextField,
  CircularProgress,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  AutoAwesome,
  CheckCircle,
  LibraryBooks,
  Gavel,
  History,
  Article,
} from '@mui/icons-material';
import { draftService } from '../services/draftService';
import { TOCTopic, GapReport, GapFinding, GapSummary } from '../types/draft.types';
import { wordDiff } from '../utils/wordDiff';

type PreviewView = 'diff' | 'edit' | 'current';
type Status = 'pending' | 'assessed' | 'applied';

interface GapReviewPanelProps {
  draftId: string;
  toc: TOCTopic[];
  onContentApplied: (topicId: string, subtopicId: string | undefined, content: string) => void;
  onReportGenerated?: (topicId: string, subtopicId: string | undefined, report: GapReport) => void;
}

// A gap unit is a topic or one of its subtopics (mirrors the content-generation rail).
interface Unit {
  key: string; // subtopicId ?? topicId
  topicId: string;
  subtopicId?: string;
  title: string;
  content: string;
  gapStatus?: Status;
  gapReportJson?: string | null;
  addedFromBenchmark?: boolean;
  isSubtopic: boolean;
  label: string; // "1" or "1.2"
}

const PURPLE_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

const SEVERITY_COLOR: Record<string, string> = {
  high: '#dc2626',
  medium: '#d97706',
  low: '#10b981',
};

const SOURCE_ICON: Record<string, React.ReactNode> = {
  benchmark: <LibraryBooks sx={{ fontSize: 13 }} />,
  regulation: <Gavel sx={{ fontSize: 13 }} />,
  previous: <History sx={{ fontSize: 13 }} />,
};

function parseReport(json?: string | null): GapReport | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as GapReport;
  } catch {
    return undefined;
  }
}

const GapReviewPanel: React.FC<GapReviewPanelProps> = ({ draftId, toc, onContentApplied, onReportGenerated }) => {
  // Flatten the TOC into gap units: each topic, and each of its subtopics.
  const units: Unit[] = useMemo(() => {
    const out: Unit[] = [];
    toc.forEach((t, ti) => {
      out.push({
        key: t.topic_id,
        topicId: t.topic_id,
        title: t.topic,
        content: t.content || '',
        gapStatus: t.gap_status as Status,
        gapReportJson: t.gap_report_json,
        addedFromBenchmark: t.added_from_benchmark,
        isSubtopic: false,
        label: String(ti + 1),
      });
      (t.subtopics || []).forEach((s, si) => {
        out.push({
          key: s.subtopic_id,
          topicId: t.topic_id,
          subtopicId: s.subtopic_id,
          title: s.topic,
          content: s.content || '',
          gapStatus: s.gap_status as Status,
          gapReportJson: s.gap_report_json,
          isSubtopic: true,
          label: `${ti + 1}.${si + 1}`,
        });
      });
    });
    return out;
  }, [toc]);

  const [selectedKey, setSelectedKey] = useState<string | null>(units[0]?.key ?? null);
  const [localReports, setLocalReports] = useState<Record<string, GapReport>>({});
  const [localStatus, setLocalStatus] = useState<Record<string, Status>>({});
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Apply → Preview → Confirm: the proposed rewrite (editable) before it's saved.
  const [proposed, setProposed] = useState<string | null>(null);
  const [proposedView, setProposedView] = useState<PreviewView>('diff');
  // Assess-all bulk run
  const [bulk, setBulk] = useState<{ running: boolean; done: number; total: number; failed: number }>({
    running: false, done: 0, total: 0, failed: 0,
  });
  const bulkCancelRef = useRef(false);
  // Gap summary report
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState<GapSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [exportingSummary, setExportingSummary] = useState(false);

  const statusOf = (u: Unit): Status => localStatus[u.key] || u.gapStatus || 'pending';

  const reportOf = (u: Unit | undefined): GapReport | undefined => {
    if (!u) return undefined;
    return localReports[u.key] || parseReport(u.gapReportJson);
  };

  const selectedUnit = useMemo(() => units.find((u) => u.key === selectedKey), [units, selectedKey]);
  const report = reportOf(selectedUnit);
  // Allow proposing a rewrite when there are confirmed-able findings, or for an empty
  // benchmark-only topic that should be seeded from the benchmark reference.
  const canPropose = !!report && (report.findings.length > 0 || !!selectedUnit?.addedFromBenchmark);

  const counts = useMemo(() => {
    let pending = 0, assessed = 0, applied = 0;
    units.forEach((u) => {
      const s = statusOf(u);
      if (s === 'applied') applied++;
      else if (s === 'assessed') assessed++;
      else pending++;
    });
    return { pending, assessed, applied };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [units, localStatus]);

  // Discard a preview whenever the selected unit changes.
  useEffect(() => {
    setProposed(null);
    setProposedView('diff');
  }, [selectedKey]);

  // Assess one unit and lift the report into the parent's TOC (survives tab switches).
  const assessUnit = async (u: Unit) => {
    const res = await draftService.generateGapReport(draftId, u.topicId, u.subtopicId);
    setLocalReports((prev) => ({ ...prev, [u.key]: res.gap_report }));
    setLocalStatus((prev) => ({ ...prev, [u.key]: 'assessed' }));
    onReportGenerated?.(u.topicId, u.subtopicId, res.gap_report);
  };

  const handleGenerate = async () => {
    if (!selectedUnit) return;
    setGenerating(true);
    setError(null);
    try {
      await assessUnit(selectedUnit);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to generate gap report.');
    } finally {
      setGenerating(false);
    }
  };

  // Assess every still-pending unit. The server runs each batch in parallel (asyncio.gather)
  // and writes once; the client drives progress by sending bounded chunks.
  const handleAssessAll = async () => {
    const pending = units.filter((u) => statusOf(u) === 'pending');
    if (pending.length === 0) return;
    bulkCancelRef.current = false;
    setError(null);
    setBulk({ running: true, done: 0, total: pending.length, failed: 0 });

    const CHUNK = 6;
    for (let i = 0; i < pending.length; i += CHUNK) {
      if (bulkCancelRef.current) break;
      const chunk = pending.slice(i, i + CHUNK);
      try {
        const res = await draftService.assessBatch(
          draftId,
          chunk.map((u) => ({ topic_id: u.topicId, subtopic_id: u.subtopicId })),
        );
        const returned = new Set<string>();
        for (const r of res.results) {
          const key = `${r.topic_id}|${r.subtopic_id ?? ''}`;
          returned.add(key);
          setLocalReports((prev) => ({ ...prev, [r.subtopic_id || r.topic_id]: r.gap_report }));
          setLocalStatus((prev) => ({ ...prev, [r.subtopic_id || r.topic_id]: 'assessed' }));
          onReportGenerated?.(r.topic_id, r.subtopic_id || undefined, r.gap_report);
        }
        const failed = chunk.filter((u) => !returned.has(`${u.topicId}|${u.subtopicId ?? ''}`)).length;
        setBulk((b) => ({ ...b, done: b.done + chunk.length, failed: b.failed + failed }));
      } catch {
        setBulk((b) => ({ ...b, done: b.done + chunk.length, failed: b.failed + chunk.length }));
      }
    }
    setBulk((b) => ({ ...b, running: false }));
  };

  // Step 1: generate the proposed rewrite from the confirmed findings (no save).
  const handlePreview = async () => {
    if (!selectedUnit || !report) return;
    setPreviewing(true);
    setError(null);
    try {
      const confirmedIds = report.findings
        .filter((f) => confirmed[f.id] !== false)
        .map((f) => f.id);
      const editedFindings: GapFinding[] = report.findings
        .filter((f) => confirmed[f.id] !== false && edits[f.id] !== undefined)
        .map((f) => ({ ...f, suggested_change: edits[f.id] }));

      const res = await draftService.previewGap(draftId, selectedUnit.topicId, {
        confirmed_finding_ids: confirmedIds,
        edited_findings: editedFindings.length ? editedFindings : undefined,
        subtopic_id: selectedUnit.subtopicId,
      });

      setProposed(res.content);
      setProposedView('diff');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to generate proposed changes.');
    } finally {
      setPreviewing(false);
    }
  };

  // Step 2: commit the reviewer-approved (possibly edited) content.
  const handleConfirm = async () => {
    if (!selectedUnit || proposed === null) return;
    setApplying(true);
    setError(null);
    try {
      const res = await draftService.confirmGap(draftId, selectedUnit.topicId, proposed, selectedUnit.subtopicId);

      setLocalStatus((prev) => ({ ...prev, [selectedUnit.key]: 'applied' }));
      onContentApplied(selectedUnit.topicId, selectedUnit.subtopicId, res.content);
      setProposed(null);

      // Auto-advance to the next not-yet-applied unit (prefer the one after this).
      const curIdx = units.findIndex((u) => u.key === selectedUnit.key);
      const next =
        units.slice(curIdx + 1).find((u) => statusOf(u) !== 'applied') ||
        units.find((u) => u.key !== selectedUnit.key && statusOf(u) !== 'applied');
      if (next) setSelectedKey(next.key);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to save changes.');
    } finally {
      setApplying(false);
    }
  };

  const handleOpenSummary = async () => {
    setSummaryOpen(true);
    setSummary(null);
    setSummaryLoading(true);
    try {
      setSummary(await draftService.getGapSummary(draftId));
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to build summary.');
      setSummaryOpen(false);
    } finally {
      setSummaryLoading(false);
    }
  };

  const handleExportSummary = async () => {
    setExportingSummary(true);
    try {
      const blob = await draftService.exportGapSummary(draftId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gap_summary.docx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to export summary.');
    } finally {
      setExportingSummary(false);
    }
  };

  // Consolidate this section's theme from across the whole policy (Stage 2 on-demand action);
  // the result is reviewed through the same preview → confirm flow.
  const [consolidating, setConsolidating] = useState(false);
  const handleConsolidate = async () => {
    if (!selectedUnit) return;
    setConsolidating(true);
    setError(null);
    try {
      const res = await draftService.consolidateTheme(draftId, selectedUnit.topicId, selectedUnit.subtopicId);
      setProposed(res.content);
      setProposedView('diff');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Failed to consolidate this theme.');
    } finally {
      setConsolidating(false);
    }
  };

  // One finding card (with evidence). Extracted so findings can be grouped benchmark-first then law.
  const renderFinding = (f: GapFinding) => (
    <Paper
      key={f.id}
      elevation={0}
      sx={{ p: 1.5, mb: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, opacity: confirmed[f.id] === false ? 0.55 : 1 }}
    >
      <Box display="flex" alignItems="flex-start" gap={1}>
        <Checkbox
          size="small"
          checked={confirmed[f.id] !== false}
          onChange={(e) => setConfirmed((prev) => ({ ...prev, [f.id]: e.target.checked }))}
          sx={{ p: 0.25, color: '#667eea', '&.Mui-checked': { color: '#667eea' } }}
        />
        <Box sx={{ flex: 1 }}>
          <Box display="flex" alignItems="center" gap={0.5} mb={0.5} flexWrap="wrap">
            <Chip
              label={f.type.replace('_', ' ')}
              size="small"
              sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, textTransform: 'capitalize', color: '#667eea', backgroundColor: '#f5f3ff' }}
            />
            <Chip
              icon={SOURCE_ICON[f.source] as any}
              label={f.source}
              size="small"
              sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, textTransform: 'capitalize', color: '#475569', backgroundColor: '#f1f5f9' }}
            />
            <Chip
              label={f.severity}
              size="small"
              sx={{ height: 20, fontSize: '0.6rem', fontWeight: 700, textTransform: 'capitalize', color: 'white', backgroundColor: SEVERITY_COLOR[f.severity] || '#64748b' }}
            />
          </Box>
          <Typography variant="body2" sx={{ mb: 1, color: '#2d3748' }}>{f.description}</Typography>
          {f.evidence && (
            <Box sx={{ mb: 1, p: 1, borderLeft: '3px solid #c4b5fd', backgroundColor: '#faf5ff', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#7c3aed', mb: 0.25 }}>
                Evidence{f.evidence_source ? ` — ${f.evidence_source}` : ''}
              </Typography>
              <Typography variant="caption" sx={{ display: 'block', fontStyle: 'italic', color: '#475569' }}>
                “{f.evidence}”
              </Typography>
            </Box>
          )}
          <TextField
            fullWidth
            multiline
            size="small"
            label="Suggested change"
            value={edits[f.id] ?? f.suggested_change}
            onChange={(e) => setEdits((prev) => ({ ...prev, [f.id]: e.target.value }))}
            InputProps={{ sx: { fontSize: '0.8rem' } }}
          />
        </Box>
      </Box>
    </Paper>
  );

  // Group findings into the client's per-section pipeline: benchmark check first, then law/regulation.
  const findingGroups: { key: string; label: string; items: GapFinding[] }[] = report
    ? [
        { key: 'benchmark', label: '1. Benchmark check', items: report.findings.filter((f) => f.source === 'benchmark') },
        { key: 'regulation', label: '2. Law / regulation check', items: report.findings.filter((f) => f.source === 'regulation') },
        { key: 'previous', label: '3. Continuity (previous policy)', items: report.findings.filter((f) => f.source === 'previous') },
      ].filter((g) => g.items.length > 0)
    : [];

  const statusChip = (s: Status) => {
    const map: Record<Status, { label: string; color: string; bg: string }> = {
      pending: { label: 'Pending', color: '#64748b', bg: '#f1f5f9' },
      assessed: { label: 'Assessed', color: '#7c3aed', bg: '#f5f3ff' },
      applied: { label: 'Applied', color: '#059669', bg: '#ecfdf5' },
    };
    const c = map[s];
    return (
      <Chip
        label={c.label}
        size="small"
        sx={{ height: 20, fontSize: '0.62rem', fontWeight: 600, color: c.color, backgroundColor: c.bg }}
      />
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, minHeight: { md: 500 } }}>
      {/* Left rail — unit progress (topics + nested subtopics) */}
      <Paper
        elevation={0}
        sx={{
          width: { xs: '100%', md: 260 },
          minWidth: { md: 260 },
          flexShrink: 0,
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          overflow: 'hidden',
          maxHeight: { xs: 280, md: 'none' },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ p: 1.5, px: 2, background: PURPLE_GRADIENT, color: 'white' }}>
          <Typography variant="body1" fontWeight={600}>Gap Review</Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            {counts.applied}/{units.length} applied · {counts.assessed} assessed
          </Typography>
          <Box sx={{ mt: 1 }}>
            {bulk.running ? (
              <Box display="flex" alignItems="center" gap={1}>
                <CircularProgress size={14} sx={{ color: 'white' }} />
                <Typography variant="caption" sx={{ flex: 1 }}>
                  Assessing {bulk.done}/{bulk.total}{bulk.failed ? ` · ${bulk.failed} failed` : ''}
                </Typography>
                <Button
                  size="small"
                  onClick={() => { bulkCancelRef.current = true; }}
                  sx={{ minWidth: 0, py: 0, px: 1, fontSize: '0.65rem', color: 'white', borderColor: 'rgba(255,255,255,0.6)', textTransform: 'none' }}
                  variant="outlined"
                >
                  Cancel
                </Button>
              </Box>
            ) : (
              counts.pending > 0 && (
                <Button
                  size="small"
                  fullWidth
                  startIcon={<AutoAwesome sx={{ fontSize: 14 }} />}
                  onClick={handleAssessAll}
                  sx={{
                    py: 0.4, fontSize: '0.7rem', fontWeight: 600, textTransform: 'none',
                    color: '#fff', background: 'rgba(255,255,255,0.18)',
                    '&:hover': { background: 'rgba(255,255,255,0.28)' },
                  }}
                >
                  Assess all pending ({counts.pending})
                </Button>
              )
            )}
            {(counts.assessed > 0 || counts.applied > 0) && !bulk.running && (
              <Button
                size="small"
                fullWidth
                startIcon={<Article sx={{ fontSize: 14 }} />}
                onClick={handleOpenSummary}
                sx={{
                  mt: 0.5, py: 0.4, fontSize: '0.7rem', fontWeight: 600, textTransform: 'none',
                  color: '#fff', border: '1px solid rgba(255,255,255,0.5)',
                  '&:hover': { background: 'rgba(255,255,255,0.15)' },
                }}
              >
                View summary report
              </Button>
            )}
          </Box>
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
          {units.map((u) => {
            const active = u.key === selectedKey;
            return (
              <Paper
                key={u.key}
                elevation={0}
                onClick={() => setSelectedKey(u.key)}
                sx={{
                  p: 1,
                  mb: 0.5,
                  ml: u.isSubtopic ? 2 : 0,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: active ? '#667eea' : '#e2e8f0',
                  background: active ? '#f5f3ff' : 'white',
                  borderRadius: 1.5,
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: '#667eea' },
                }}
              >
                <Box display="flex" alignItems="center" gap={0.75} mb={0.5}>
                  <Typography variant="caption" fontWeight={700} sx={{ color: active ? '#667eea' : '#94a3b8' }}>
                    {u.label}
                  </Typography>
                  <Typography
                    variant="caption"
                    fontWeight={u.isSubtopic ? 500 : 600}
                    sx={{ color: active ? '#667eea' : '#2d3748', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                  >
                    {u.title}
                  </Typography>
                </Box>
                <Box display="flex" alignItems="center" gap={0.5} flexWrap="wrap">
                  {statusChip(statusOf(u))}
                  {u.addedFromBenchmark && (
                    <Tooltip title="Auto-added because the client policy lacked this section">
                      <Chip
                        icon={<LibraryBooks sx={{ fontSize: 12 }} />}
                        label="From benchmark"
                        size="small"
                        sx={{ height: 20, fontSize: '0.6rem', fontWeight: 600, color: '#764ba2', backgroundColor: '#faf5ff' }}
                      />
                    </Tooltip>
                  )}
                </Box>
              </Paper>
            );
          })}
        </Box>
      </Paper>

      {/* Right — gap report for the selected unit */}
      <Paper
        elevation={0}
        sx={{ flex: 1, border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {!selectedUnit ? (
          <Box sx={{ p: 3 }}>
            <Typography color="text.secondary">Select a topic or subtopic to review.</Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ p: 2, borderBottom: '1px solid #e2e8f0' }}>
              <Box display="flex" alignItems="center" gap={1}>
                <Article sx={{ color: '#667eea', fontSize: 20 }} />
                <Typography variant="body1" fontWeight={600} sx={{ flex: 1 }}>
                  {selectedUnit.label} {selectedUnit.title}
                </Typography>
                {statusChip(statusOf(selectedUnit))}
              </Box>
              {report?.benchmark_topic_matched && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Compared against benchmark section: <strong>{report.benchmark_topic_matched}</strong>
                </Typography>
              )}
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

              {proposed !== null ? (
                <>
                  <Box sx={{ display: 'flex', borderBottom: '1px solid #e2e8f0', mb: 1.5 }}>
                    {(['diff', 'edit', 'current'] as PreviewView[]).map((v) => (
                      <Button
                        key={v}
                        size="small"
                        onClick={() => setProposedView(v)}
                        sx={{
                          textTransform: 'none', fontWeight: 600, borderRadius: 0,
                          color: proposedView === v ? '#667eea' : '#64748b',
                          borderBottom: proposedView === v ? '2px solid #667eea' : '2px solid transparent',
                        }}
                      >
                        {v === 'diff' ? 'Diff' : v === 'edit' ? 'Edit' : 'Current'}
                      </Button>
                    ))}
                  </Box>

                  {proposedView === 'diff' && (
                    <Box sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.7, color: '#2d3748' }}>
                      {wordDiff(selectedUnit.content || '', proposed).map((part, i) =>
                        part.type === 'equal' ? (
                          <span key={i}>{part.value}</span>
                        ) : part.type === 'added' ? (
                          <span key={i} style={{ backgroundColor: '#dcfce7', color: '#166534' }}>{part.value}</span>
                        ) : (
                          <span key={i} style={{ backgroundColor: '#fee2e2', color: '#991b1b', textDecoration: 'line-through' }}>{part.value}</span>
                        )
                      )}
                    </Box>
                  )}

                  {proposedView === 'edit' && (
                    <TextField
                      fullWidth
                      multiline
                      minRows={10}
                      value={proposed}
                      onChange={(e) => setProposed(e.target.value)}
                      InputProps={{ sx: { fontSize: '0.85rem' } }}
                    />
                  )}

                  {proposedView === 'current' && (
                    <Box sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.7, color: '#64748b' }}>
                      {selectedUnit.content || '(This unit has no current content.)'}
                    </Box>
                  )}
                </>
              ) : !report ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No gap report yet for this {selectedUnit.isSubtopic ? 'subtopic' : 'topic'}.
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
                    disabled={generating}
                    onClick={handleGenerate}
                    sx={{ background: PURPLE_GRADIENT, textTransform: 'none', fontWeight: 600, color: '#fff', '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)', background: PURPLE_GRADIENT } }}
                  >
                    {generating ? 'Assessing…' : 'Generate gap report'}
                  </Button>
                </Box>
              ) : (
                <>
                  {report.overall_summary && (
                    <Alert severity="info" sx={{ mb: 2 }}>{report.overall_summary}</Alert>
                  )}

                  {report.findings.length === 0 ? (
                    <Box display="flex" alignItems="center" gap={1} sx={{ color: '#059669', mb: 2 }}>
                      <CheckCircle sx={{ fontSize: 18 }} />
                      <Typography variant="body2" fontWeight={600}>
                        No gaps found — this section is already strong and compliant.
                      </Typography>
                    </Box>
                  ) : (
                    findingGroups.map((g) => (
                      <Box key={g.key} sx={{ mb: 1 }}>
                        <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, color: '#64748b', mb: 0.75, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          {g.label}
                        </Typography>
                        {g.items.map((f) => renderFinding(f))}
                      </Box>
                    ))
                  )}
                </>
              )}
            </Box>

            {proposed !== null ? (
              <Box sx={{ p: 2, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Button
                  variant="text"
                  disabled={applying}
                  onClick={() => setProposed(null)}
                  sx={{ textTransform: 'none', color: '#64748b' }}
                >
                  Back
                </Button>
                <Button
                  variant="outlined"
                  disabled={previewing || applying}
                  onClick={handlePreview}
                  sx={{ textTransform: 'none', borderColor: '#667eea', color: '#667eea' }}
                >
                  {previewing ? 'Re-generating…' : 'Re-generate'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={applying ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
                  disabled={applying}
                  onClick={handleConfirm}
                  sx={{ background: PURPLE_GRADIENT, textTransform: 'none', fontWeight: 600, color: '#fff', '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)', background: PURPLE_GRADIENT } }}
                >
                  {applying ? 'Saving…' : 'Confirm & next'}
                </Button>
              </Box>
            ) : report ? (
              <Box sx={{ p: 2, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                <Tooltip title="Pull everything about this theme from across the whole policy into this section, aligned to the benchmark">
                  <span>
                    <Button
                      variant="text"
                      disabled={consolidating}
                      onClick={handleConsolidate}
                      sx={{ textTransform: 'none', color: '#764ba2' }}
                    >
                      {consolidating ? 'Consolidating…' : 'Consolidate from whole policy'}
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  variant="outlined"
                  disabled={generating}
                  onClick={handleGenerate}
                  sx={{ textTransform: 'none', borderColor: '#667eea', color: '#667eea' }}
                >
                  {generating ? 'Re-assessing…' : 'Re-assess'}
                </Button>
                <Button
                  variant="contained"
                  startIcon={previewing ? <CircularProgress size={16} color="inherit" /> : <AutoAwesome />}
                  disabled={previewing || !canPropose}
                  onClick={handlePreview}
                  sx={{ background: PURPLE_GRADIENT, textTransform: 'none', fontWeight: 600, color: '#fff', '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)', background: PURPLE_GRADIENT } }}
                >
                  {previewing ? 'Generating…' : 'Generate proposed changes'}
                </Button>
              </Box>
            ) : null}
          </>
        )}
      </Paper>

      {/* Gap summary report */}
      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Gap Assessment Summary</DialogTitle>
        <DialogContent dividers>
          {summaryLoading || !summary ? (
            <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
          ) : (
            <>
              {summary.narrative && (
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', mb: 2, color: '#2d3748' }}>
                  {summary.narrative}
                </Typography>
              )}
              <Box display="flex" gap={0.75} flexWrap="wrap" mb={2}>
                <Chip size="small" label={`${summary.applied} applied`} sx={{ backgroundColor: '#ecfdf5', color: '#059669' }} />
                <Chip size="small" label={`${summary.assessed} assessed`} sx={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }} />
                <Chip size="small" label={`${summary.pending} pending`} sx={{ backgroundColor: '#f1f5f9', color: '#64748b' }} />
                <Chip size="small" label={`${summary.total_findings} findings`} sx={{ backgroundColor: '#eff6ff', color: '#2563eb' }} />
                {summary.pct_preserved !== null && (
                  <Chip size="small" label={`${summary.pct_preserved}% baseline preserved`} sx={{ backgroundColor: '#fefce8', color: '#a16207' }} />
                )}
                <Chip size="small" label={`${summary.benchmark_coverage} benchmark-matched`} sx={{ backgroundColor: '#faf5ff', color: '#764ba2' }} />
              </Box>
              {summary.topics.filter((t) => t.findings_count > 0).map((t, i) => (
                <Box key={i} sx={{ mb: 1.5 }}>
                  <Typography variant="body2" fontWeight={600}>{t.title} <Typography component="span" variant="caption" color="text.secondary">[{t.status}]</Typography></Typography>
                  {t.overall_summary && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{t.overall_summary}</Typography>}
                  {t.findings.map((f) => (
                    <Typography key={f.id} variant="caption" sx={{ display: 'block', pl: 1, color: '#475569' }}>
                      • <strong>[{f.severity}/{f.type}]</strong> {f.description}
                    </Typography>
                  ))}
                </Box>
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryOpen(false)} sx={{ textTransform: 'none' }}>Close</Button>
          <Button
            variant="contained"
            startIcon={exportingSummary ? <CircularProgress size={16} color="inherit" /> : <Article />}
            disabled={exportingSummary || !summary}
            onClick={handleExportSummary}
            sx={{ background: PURPLE_GRADIENT, textTransform: 'none', fontWeight: 600, color: '#fff', '&.Mui-disabled': { color: 'rgba(255,255,255,0.7)', background: PURPLE_GRADIENT } }}
          >
            Export .docx
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GapReviewPanel;
