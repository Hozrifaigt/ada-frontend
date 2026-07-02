import React, { useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { CheckCircle, UploadFile, Lock, ContentPaste } from '@mui/icons-material';
import { draftService } from '../services/draftService';
import { DraftMetadata, TOCTopic, TOCSubtopic, TocStructureItem } from '../types/draft.types';
import TocEditor from './TocEditor';
import RedistributeButton from './RedistributeButton';

interface TocComparePanelProps {
  draftId: string;
  metadata: DraftMetadata;
  currentToc: TOCTopic[];
  onChanged: () => void; // reload the draft after a save/adopt
  onApproved?: () => void; // after approval — lets the parent jump straight to the Review tab
}

type WhichToc = 'client' | 'benchmark' | 'good';

const PURPLE_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

function parseJson(json?: string | null): any[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// A titles-only stored TOC ([{topic, subtopics:[{topic}]}] or DocumentProcessor topics) → TOCTopic[]
// shape the shared editor understands (synthetic ids; content is irrelevant for these columns).
function toTocTopics(raw: any[]): TOCTopic[] {
  if (!Array.isArray(raw)) return [];
  const out: TOCTopic[] = [];
  raw.forEach((t, i) => {
    const title = String(t.topic || t.title || t.name || '').trim();
    if (!title) return;
    const subsRaw = Array.isArray(t.subtopics) ? t.subtopics : [];
    const subtopics: TOCSubtopic[] = [];
    subsRaw.forEach((s: any, j: number) => {
      const stitle = String(typeof s === 'string' ? s : (s.topic || s.title || s.name || '')).trim();
      if (!stitle) return;
      subtopics.push({
        subtopic_id: `s_${i}_${j}_${stitle}`, topic: stitle, order: j + 1,
        content: '', summary: '', conversation_history: [],
      });
    });
    out.push({
      topic_id: `t_${i}_${title}`, topic: title, order: i + 1,
      content: '', summary: '', conversation_history: [], subtopics,
    });
  });
  return out;
}

// TOCTopic[] → TocStructureItem[] for the snapshot save. Ids are included so a RENAMED section
// keeps its content/baseline/review state (the backend matches by id first, title second).
function toStructureItems(toc: TOCTopic[]): TocStructureItem[] {
  return (toc || [])
    .map(t => ({
      id: t.topic_id,
      title: (t.topic || '').trim(),
      subtopics: (t.subtopics || [])
        .map(s => ({ id: s.subtopic_id, title: (s.topic || '').trim() }))
        .filter(s => s.title),
    }))
    .filter(t => t.title);
}

// One step of the TOC-stage journey. The gates (Map before Approve, etc.) always existed in the
// button logic — this strip makes the journey visible instead of discovered via disabled buttons.
const WorkflowStep: React.FC<{ index: number; label: string; done: boolean; active: boolean; last?: boolean }> = ({
  index, label, done, active, last,
}) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
    <Box
      sx={{
        width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        bgcolor: done ? '#ecfdf5' : active ? '#eef2ff' : '#f1f5f9',
        color: done ? '#059669' : active ? '#4338ca' : '#94a3b8',
        border: `1px solid ${done ? '#a7f3d0' : active ? '#c7d2fe' : '#e2e8f0'}`,
        fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
      }}
    >
      {done ? <CheckCircle sx={{ fontSize: 14 }} /> : index}
    </Box>
    <Typography
      variant="caption"
      sx={{ fontWeight: active ? 700 : 500, color: done ? '#059669' : active ? '#4338ca' : '#94a3b8', whiteSpace: 'nowrap' }}
    >
      {label}
    </Typography>
    {!last && <Box sx={{ width: 22, height: '1px', bgcolor: '#e2e8f0', mx: 0.5 }} />}
  </Box>
);

// Each column carries its own identity: accent top border + tinted header/body, so Current /
// Benchmark / Good read as three different things at a glance (no explainer text needed).
const ColumnShell: React.FC<{
  title: string; subtitle: string; accent: string; headerTint: string; bodyTint: string;
  headerAction?: React.ReactNode; children: React.ReactNode;
}> = ({ title, subtitle, accent, headerTint, bodyTint, headerAction, children }) => (
  <Paper
    elevation={0}
    sx={{
      flex: 1, minWidth: 260, border: '1px solid #e2e8f0', borderTop: `3px solid ${accent}`,
      borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', backgroundColor: bodyTint,
    }}
  >
    <Box sx={{ p: 1.25, px: 1.5, borderBottom: '1px solid #e2e8f0', backgroundColor: headerTint, display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} sx={{ color: accent }}>{title}</Typography>
        <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
      </Box>
      {headerAction}
    </Box>
    <Box sx={{ p: 1.25, flex: 1 }}>{children}</Box>
  </Paper>
);

const TocComparePanel: React.FC<TocComparePanelProps> = ({ draftId, metadata, currentToc, onChanged, onApproved }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<TocStructureItem[] | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [savingCol, setSavingCol] = useState<WhichToc | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clientToc = useMemo(() => toTocTopics(parseJson(metadata.client_toc_json)), [metadata.client_toc_json]);
  // Prefer the titles-only benchmark snapshot (set for any source); fall back to the uploaded-only full JSON.
  const benchmarkToc = useMemo(
    () => toTocTopics(parseJson(metadata.benchmark_toc_json || metadata.benchmark_topics_json)),
    [metadata.benchmark_toc_json, metadata.benchmark_topics_json]
  );

  // TOC-stage journey state (drives the workflow strip + the existing button gates).
  const hasBenchmarkSource = !!(metadata.benchmark_toc_json || metadata.benchmark_topics_json || metadata.benchmark_policy_id);
  const workflowSteps = [
    { label: 'Attach benchmark', done: hasBenchmarkSource },
    { label: 'Build Good TOC', done: (currentToc?.length || 0) > 0 },
    { label: 'Map client content', done: !!metadata.content_mapped },
    { label: 'Approve TOC', done: !!metadata.toc_approved },
  ];
  const activeStepIdx = workflowSteps.findIndex((s) => !s.done);
  // Sections/subsections the reconcile added from the benchmark — shown on the Good column header.
  const addedCount = useMemo(
    () => (currentToc || []).reduce(
      (n, t) => n + (t.added_from_benchmark ? 1 : 0) + (t.subtopics || []).filter((s) => s.added_from_benchmark).length,
      0
    ),
    [currentToc]
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) e.target.value = '';
    if (!file) return;
    if (!file.name.endsWith('.docx')) { setError('Only .docx files are supported.'); return; }
    setBusy('extract'); setError(null);
    try {
      const res = await draftService.extractTocFromFile(draftId, file);
      setPreview(res.preview_toc);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not extract a TOC from that file.');
    } finally { setBusy(null); }
  };

  // The uploaded file's TOC becomes the Extracted (benchmark) TOC.
  const handleUseExtracted = async (items: TocStructureItem[]) => {
    setBusy('use'); setError(null);
    try {
      await draftService.saveTocSnapshot(draftId, 'benchmark', items);
      setPreview(null);
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not save the Benchmark TOC.');
    } finally { setBusy(null); }
  };

  // Paste a TOC as text → the LLM converts it to our structure → it becomes the Benchmark TOC.
  const handlePasteConvert = async () => {
    if (!pasteText.trim()) return;
    setBusy('paste'); setError(null);
    try {
      const res = await draftService.tocFromText(draftId, pasteText);
      await draftService.saveTocSnapshot(draftId, 'benchmark', res.preview_toc);
      setPasteOpen(false);
      setPasteText('');
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not convert that pasted TOC.');
    } finally { setBusy(null); }
  };

  // Re-derive a fresh Good TOC by reconciling the current Current + Extracted TOCs.
  const handleRegenerate = async () => {
    setBusy('regen'); setError(null);
    try {
      await draftService.regenerateGoodToc(draftId);
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not reconsider the Good TOC.');
    } finally { setBusy(null); }
  };

  const handleApprove = async () => {
    setBusy('approve'); setError(null);
    try {
      await draftService.approveToc(draftId);
      (onApproved || onChanged)();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not approve the TOC.');
    } finally { setBusy(null); }
  };

  // Save an edited column. 'good' adopts as the working TOC (content re-mapped by title);
  // 'client'/'benchmark' just update their reference snapshot.
  const handleSaveColumn = async (which: WhichToc, toc: TOCTopic[]) => {
    setSavingCol(which); setError(null);
    try {
      await draftService.saveTocSnapshot(draftId, which, toStructureItems(toc));
      onChanged();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Could not save that TOC.');
    } finally { setSavingCol(null); }
  };

  return (
    <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, p: 2, mb: 2 }}>
      <input ref={fileRef} type="file" accept=".docx" hidden onChange={handleFile} />
      <Box display="flex" alignItems="center" gap={1} mb={1.5}>
        <Typography variant="subtitle1" fontWeight={700} sx={{ flex: 1 }}>
          Build the perfect Table of Contents
        </Typography>
        {/* Workflow gate: need a Good TOC to map; need a mapping before you can approve. */}
        {(() => {
          const hasGoodToc = (currentToc?.length || 0) > 0;
          const canApprove = hasGoodToc && !!metadata.content_mapped;
          const approveTip = !hasGoodToc
            ? 'Build the Good TOC first'
            : !metadata.content_mapped
            ? 'Map client content into the sections first'
            : 'Lock this as the agreed structure before per-section review';
          return (
            <>
              <Tooltip title={hasGoodToc ? 'Map the client content into the Good TOC sections' : 'Build the Good TOC first'}>
                <span>
                  <RedistributeButton
                    draftId={draftId}
                    onApplied={onChanged}
                    onApproved={onApproved}
                    disabled={!hasGoodToc}
                    showApprove={!metadata.toc_approved}
                  />
                </span>
              </Tooltip>
              {metadata.toc_approved ? (
                <Chip icon={<CheckCircle sx={{ fontSize: 16 }} />} label="TOC approved" size="small" sx={{ color: '#059669', backgroundColor: '#ecfdf5', fontWeight: 600 }} />
              ) : (
                <Tooltip title={approveTip}>
                  <span>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={busy === 'approve' ? <CircularProgress size={14} color="inherit" /> : <Lock sx={{ fontSize: 16 }} />}
                      disabled={busy === 'approve' || !canApprove}
                      onClick={handleApprove}
                      sx={{ background: PURPLE_GRADIENT, textTransform: 'none', fontWeight: 600, color: '#fff', '&.Mui-disabled': { color: '#fff', opacity: 0.55 } }}
                    >
                      Approve TOC &amp; continue
                    </Button>
                  </span>
                </Tooltip>
              )}
            </>
          );
        })()}
      </Box>

      {/* The journey at a glance — done / current / upcoming. */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, mb: 1.5, p: 1, px: 1.5, bgcolor: '#f8fafc', border: '1px solid #eef0f6', borderRadius: 2 }}>
        {workflowSteps.map((s, i) => (
          <WorkflowStep key={s.label} index={i + 1} label={s.label} done={s.done} active={i === activeStepIdx} last={i === workflowSteps.length - 1} />
        ))}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>
          {metadata.toc_approved ? 'Structure agreed — continue in the Review tab' : 'Approving unlocks the section-by-section review'}
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert>}

      {/* Three editable TOCs side by side — same drag-and-drop editor as the Table of Contents below */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: { xs: 'wrap', lg: 'nowrap' }, mb: 2, alignItems: 'flex-start' }}>
        <ColumnShell
          title="Current TOC" subtitle="The client's policy as uploaded"
          accent="#64748b" headerTint="#f1f5f9" bodyTint="#f8fafc"
        >
          <TocEditor toc={clientToc} saving={savingCol === 'client'} onSave={(t) => handleSaveColumn('client', t)} />
        </ColumnShell>
        <ColumnShell
          title="Benchmark TOC"
          subtitle={
            metadata.benchmark_source === 'library' ? 'From the library benchmark'
            : metadata.benchmark_source === 'uploaded' ? 'From the uploaded benchmark'
            : hasBenchmarkSource ? 'From the benchmark'
            : 'None yet — upload or paste one'
          }
          accent="#764ba2" headerTint="#f5f0fa" bodyTint="#fbf9fe"
          headerAction={
            <Box display="flex" alignItems="center">
              <Tooltip title="Paste a TOC as text — the AI converts it and sets it as the Benchmark TOC">
                <span>
                  <IconButton size="small" disabled={busy === 'paste'} onClick={() => setPasteOpen(true)} sx={{ color: '#764ba2' }}>
                    {busy === 'paste' ? <CircularProgress size={16} /> : <ContentPaste sx={{ fontSize: 17 }} />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Upload a .docx to extract its TOC as the Benchmark TOC">
                <span>
                  <IconButton size="small" disabled={busy === 'extract'} onClick={() => fileRef.current?.click()} sx={{ color: '#764ba2' }}>
                    {busy === 'extract' ? <CircularProgress size={16} /> : <UploadFile sx={{ fontSize: 18 }} />}
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          }
        >
          <TocEditor toc={benchmarkToc} saving={savingCol === 'benchmark'} onSave={(t) => handleSaveColumn('benchmark', t)} />
        </ColumnShell>
        <ColumnShell
          title="Good TOC (working)" subtitle="The one you'll approve & build from"
          accent="#667eea" headerTint="#eef2ff" bodyTint="#f8f9ff"
          headerAction={
            <Box display="flex" alignItems="center" gap={0.5}>
              {addedCount > 0 && (
                <Tooltip title={`${addedCount} section${addedCount > 1 ? 's' : ''} added from the benchmark — marked with green chips below`}>
                  <Chip
                    size="small" label={`+${addedCount} added`}
                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700, bgcolor: '#dcfce7', color: '#15803d' }}
                  />
                </Tooltip>
              )}
              <Tooltip title="Regenerate a fresh Good TOC by re-merging the current Current + Benchmark TOCs">
                <span>
                  <Button
                    size="small" disabled={busy === 'regen'} onClick={handleRegenerate}
                    startIcon={busy === 'regen' ? <CircularProgress size={13} /> : undefined}
                    sx={{ textTransform: 'none', color: '#667eea', fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap' }}
                  >
                    Regenerate
                  </Button>
                </span>
              </Tooltip>
            </Box>
          }
        >
          <TocEditor toc={currentToc} saving={savingCol === 'good'} onSave={(t) => handleSaveColumn('good', t)} />
        </ColumnShell>
      </Box>

      {/* Preview of an uploaded file's TOC — shown as a modal so a long TOC doesn't push the layout */}
      <Dialog open={!!preview} onClose={() => (busy === 'use' ? null : setPreview(null))} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Benchmark TOC from file{preview ? ` — ${preview.length} sections` : ''}
        </DialogTitle>
        <DialogContent dividers sx={{ maxHeight: '60vh' }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Approving this replaces the Benchmark TOC.
          </Typography>
          {(preview || []).map((t, i) => (
            <Box key={i} sx={{ mb: 0.5 }}>
              <Typography variant="caption" fontWeight={600}>{i + 1}. {t.title}</Typography>
              {(t.subtopics || []).map((s, j) => (
                <Typography key={j} variant="caption" sx={{ display: 'block', pl: 1.5, color: '#64748b' }}>
                  {i + 1}.{j + 1} {typeof s === 'string' ? s : s.title}
                </Typography>
              ))}
            </Box>
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPreview(null)} disabled={busy === 'use'} sx={{ textTransform: 'none', color: '#64748b' }}>
            Disregard
          </Button>
          <Button
            variant="contained"
            onClick={() => preview && handleUseExtracted(preview)}
            disabled={busy === 'use'}
            startIcon={busy === 'use' ? <CircularProgress size={14} color="inherit" /> : <CheckCircle sx={{ fontSize: 16 }} />}
            sx={{ background: PURPLE_GRADIENT, textTransform: 'none', fontWeight: 600, color: '#fff' }}
          >
            Approve &amp; use as Benchmark
          </Button>
        </DialogActions>
      </Dialog>

      {/* Paste-a-TOC modal: the AI converts the pasted text into our structure and sets it as Benchmark */}
      <Dialog open={pasteOpen} onClose={() => (busy === 'paste' ? null : setPasteOpen(false))} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Paste a Table of Contents</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Paste a TOC (any format). The AI converts it to our structure and sets it as the Benchmark TOC.
          </Typography>
          <TextField
            autoFocus fullWidth multiline minRows={6}
            placeholder={'1. Purpose and Scope\n   1.1 Objectives\n2. Definitions\n3. Roles and Responsibilities'}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            InputProps={{ sx: { fontSize: '0.8rem' } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setPasteOpen(false)} disabled={busy === 'paste'} sx={{ textTransform: 'none', color: '#64748b' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handlePasteConvert}
            disabled={busy === 'paste' || !pasteText.trim()}
            startIcon={busy === 'paste' ? <CircularProgress size={14} color="inherit" /> : <ContentPaste sx={{ fontSize: 16 }} />}
            sx={{ background: PURPLE_GRADIENT, textTransform: 'none', fontWeight: 600, color: '#fff' }}
          >
            {busy === 'paste' ? 'Converting…' : 'Convert & set as Benchmark'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TocComparePanel;
