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
  Divider,
  Stepper,
  Step,
  StepButton,
} from '@mui/material';
import {
  LibraryBooks,
  Gavel,
  CheckCircle,
  Lock,
  Send,
  UploadFile,
} from '@mui/icons-material';
import { draftService } from '../services/draftService';
import { TOCTopic, GapFinding } from '../types/draft.types';
import { wordDiff } from '../utils/wordDiff';

type ReviewStep = 'pending' | 'benchmark' | 'regulation' | 'review' | 'closed';

interface ReviewPipelinePanelProps {
  draftId: string;
  toc: TOCTopic[];
  // reviewStep is propagated so the parent's currentToc reflects the new step (survives tab switch / remount).
  onContentApplied: (topicId: string, subtopicId: string | undefined, content: string, reviewStep?: ReviewStep) => void;
}

// A review unit is a topic or one of its subtopics.
interface Unit {
  key: string;
  topicId: string;
  subtopicId?: string;
  title: string;
  content: string;
  baseline: string;
  reviewStep: ReviewStep;
  isSubtopic: boolean;
  label: string;
}

interface BenchmarkResult {
  baseline_content: string;
  benchmark_content: string;
  benchmark_match: string | null;
  findings: GapFinding[];
  as_is_suggestion: string;
}

const SEVERITY_COLOR: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#10b981' };
const TYPE_LABEL: Record<string, string> = { missing: 'Missing', non_compliant: 'Non-compliant', enhancement: 'Enhancement' };

// The per-section timeline.
const STEPS = ['Benchmark', 'Regulation', 'Finalize'];
// How many steps are complete, from the persisted review_step.
const completedThrough = (s: ReviewStep): number =>
  s === 'pending' ? 0 : s === 'benchmark' ? 1 : s === 'closed' ? 3 : 2; // regulation/review → 2

interface RegResult {
  applies: boolean;
  extract: string;
  suggestion: string;
  // false = no regulation source loaded for this draft (distinct from "checked, none apply").
  has_regulations: boolean;
}

interface ChatMsg {
  user: string;
  ai: string;
}

const PURPLE_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
// Gradient button that keeps its label white even while disabled (loading).
const GRADIENT_BTN = { background: PURPLE_GRADIENT, color: '#fff', '&.Mui-disabled': { color: '#fff', opacity: 0.55 } };

// Provenance (same language as the TOC "Map content" view): does this section come from the client
// policy (it has frozen baseline content) or was it added from the benchmark (no client baseline)?
type Provenance = 'kept' | 'added';
const PROV = {
  kept: { color: '#2563eb', bg: '#eff6ff', label: 'kept' },   // blue — from the client policy
  added: { color: '#10b981', bg: '#ecfdf5', label: 'added' }, // green — new / from benchmark
};

function DiffView({ current, proposed }: { current: string; proposed: string }) {
  const parts = wordDiff(current, proposed);
  return (
    <Box sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: 1.6 }}>
      {parts.map((p, i) => (
        <span
          key={i}
          style={{
            backgroundColor: p.type === 'added' ? '#dcfce7' : p.type === 'removed' ? '#fee2e2' : 'transparent',
            color: p.type === 'removed' ? '#991b1b' : p.type === 'added' ? '#166534' : 'inherit',
            textDecoration: p.type === 'removed' ? 'line-through' : 'none',
          }}
        >
          {p.value}
        </span>
      ))}
    </Box>
  );
}

const ReviewPipelinePanel: React.FC<ReviewPipelinePanelProps> = ({ draftId, toc, onContentApplied }) => {
  const units: Unit[] = useMemo(() => {
    const out: Unit[] = [];
    toc.forEach((t, ti) => {
      out.push({
        key: t.topic_id,
        topicId: t.topic_id,
        title: t.topic,
        content: t.content || '',
        baseline: t.baseline_content || '',
        reviewStep: (t.review_step as ReviewStep) || 'pending',
        isSubtopic: false,
        label: `${ti + 1}`,
      });
      (t.subtopics || []).forEach((s, si) => {
        out.push({
          key: s.subtopic_id,
          topicId: t.topic_id,
          subtopicId: s.subtopic_id,
          title: s.topic,
          content: s.content || '',
          baseline: s.baseline_content || '',
          reviewStep: (s.review_step as ReviewStep) || 'pending',
          isSubtopic: true,
          label: `${ti + 1}.${si + 1}`,
        });
      });
    });
    return out;
  }, [toc]);

  // Local review_step overrides so badges update on apply/close without reloading the draft
  // (a reload would bounce the reviewer off the Review tab — loadDraft lands review drafts on the TOC tab).
  const [stepOverrides, setStepOverrides] = useState<Record<string, ReviewStep>>({});
  const stepOf = (u: Unit): ReviewStep => stepOverrides[u.key] ?? u.reviewStep;
  // A section with frozen client baseline text came from the client policy ("kept"); otherwise it was
  // added from the benchmark ("added").
  const provOf = (u: Unit): Provenance => ((u.baseline || '').trim() ? 'kept' : 'added');

  const [selectedKey, setSelectedKey] = useState<string | null>(units[0]?.key ?? null);
  const selected = units.find((u) => u.key === selectedKey) || null;
  const selectedStep: ReviewStep = selected ? stepOf(selected) : 'pending';
  // A closed (done) section is read-only until reopened — no benchmark/regulation/edit actions.
  const locked = selectedStep === 'closed';
  // The benchmark step compares the client's baseline against the benchmark. With no baseline (and no
  // content yet) there is nothing to assess, so Run benchmark is disabled for that section.
  const hasBaselineContent = !!((selected?.baseline || selected?.content || '').trim());

  // Editable working content for the selected unit.
  const [editContent, setEditContent] = useState('');
  const [benchmark, setBenchmark] = useState<BenchmarkResult | null>(null);
  const [checkedFindings, setCheckedFindings] = useState<Record<string, boolean>>({});
  const [reg, setReg] = useState<RegResult | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [preview, setPreview] = useState<{ content: string; step: ReviewStep; label: string } | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [regsMsg, setRegsMsg] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const regFileRef = useRef<HTMLInputElement>(null);
  // Manual benchmark override (Review tab): reviewer-supplied benchmark text for the selected section.
  const [manualOpen, setManualOpen] = useState(false);
  const [manualBench, setManualBench] = useState('');

  // Re-seed per-section state when the selection changes.
  useEffect(() => {
    setEditContent(selected?.content || '');
    setBenchmark(null);
    setCheckedFindings({});
    setReg(null);
    setChat([]);
    setChatInput('');
    setPreview(null);
    setError(null);
    setManualOpen(false);
    setManualBench('');
    // Open the timeline at the section's current point in the pipeline.
    setActiveStep(Math.min(completedThrough(selected?.reviewStep || 'pending'), 2));
  }, [selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat]);

  const closedCount = units.filter((u) => stepOf(u) === 'closed').length;

  const runBenchmark = async () => {
    if (!selected) return;
    setBusy('benchmark');
    setError(null);
    try {
      const r = await draftService.reviewBenchmark(draftId, selected.topicId, selected.subtopicId);
      setBenchmark(r);
      // Default every found gap to ticked — the reviewer unticks the ones they don't accept.
      const checks: Record<string, boolean> = {};
      r.findings.forEach((f) => { checks[f.id] = true; });
      setCheckedFindings(checks);
    } catch (e: any) {
      setError(e?.message || 'Benchmark review failed');
    } finally {
      setBusy(null);
    }
  };

  // Save (or clear) the reviewer's manual benchmark text for this section, then re-run the benchmark
  // assessment so the findings/as-is reflect the supplied text.
  const saveManualBench = async (clear: boolean) => {
    if (!selected) return;
    setError(null);
    try {
      setBusy('manualbench');
      await draftService.setBenchmarkContent(draftId, selected.topicId, clear ? '' : manualBench, selected.subtopicId);
      if (clear) setManualBench('');
      setManualOpen(false);
    } catch (e: any) {
      setError(e?.message || 'Could not save manual benchmark');
      setBusy(null);
      return;
    }
    setBusy(null);
    await runBenchmark();
  };

  // "Tweak to fix gaps": apply ONLY the ticked findings via the apply-gap merge engine (preserves baseline),
  // returned as a preview to confirm.
  const tweakSelected = async () => {
    if (!selected || !benchmark) return;
    const ids = benchmark.findings.filter((f) => checkedFindings[f.id]).map((f) => f.id);
    if (!ids.length) return;
    setBusy('tweak');
    setError(null);
    try {
      const r = await draftService.previewGap(draftId, selected.topicId, {
        confirmed_finding_ids: ids,
        subtopic_id: selected.subtopicId,
      });
      setPreview({ content: r.content, step: 'benchmark', label: `Fix gaps (${ids.length} selected)` });
    } catch (e: any) {
      setError(e?.message || 'Could not generate the tweak');
    } finally {
      setBusy(null);
    }
  };

  const runRegulation = async () => {
    if (!selected) return;
    setBusy('regulation');
    setError(null);
    try {
      const r = await draftService.reviewRegulation(draftId, selected.topicId, selected.subtopicId);
      setReg(r);
    } catch (e: any) {
      setError(e?.message || 'Regulation check failed');
    } finally {
      setBusy(null);
    }
  };

  // Re-upload regulation files to the draft (Review tab → Regulations). Draft-scoped, not per section.
  const uploadRegs = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy('regupload');
    setError(null);
    setRegsMsg(null);
    try {
      const r = await draftService.uploadRegulations(draftId, Array.from(files));
      setRegsMsg(r.message);
      // Reflect that regulations now exist so the empty-state flips immediately.
      setReg((prev) => (prev ? { ...prev, has_regulations: r.has_regulations } : prev));
    } catch (e: any) {
      setError(e?.message || 'Could not upload regulations');
    } finally {
      setBusy(null);
      if (regFileRef.current) regFileRef.current.value = '';
    }
  };

  const sendChat = async () => {
    if (!selected || !chatInput.trim()) return;
    const message = chatInput.trim();
    setChatInput('');
    setBusy('chat');
    setError(null);
    try {
      const r = await draftService.reviewChat(draftId, selected.topicId, message, selected.subtopicId);
      setChat((c) => [...c, { user: message, ai: r.reply }]);
      if (r.proposed_content) {
        setPreview({ content: r.proposed_content, step: 'review', label: 'Proposed by assistant' });
      }
    } catch (e: any) {
      setError(e?.message || 'Chat failed');
      setChat((c) => [...c, { user: message, ai: '(failed to respond)' }]);
    } finally {
      setBusy(null);
    }
  };

  // Apply a previewed change OR persist the current manual edits.
  const applyContent = async (content: string, step: ReviewStep) => {
    if (!selected) return;
    setBusy('apply');
    setError(null);
    try {
      const applyStep = step === 'closed' || step === 'pending' ? 'review' : step;
      await draftService.reviewApply(draftId, selected.topicId, content, applyStep as any, selected.subtopicId);
      setEditContent(content);
      setPreview(null);
      setStepOverrides((prev) => ({ ...prev, [selected.key]: applyStep as ReviewStep }));
      // Done with a step → move the timeline forward (you can still click back).
      if (step === 'benchmark') setActiveStep(1);
      else if (step === 'regulation') setActiveStep(2);
      onContentApplied(selected.topicId, selected.subtopicId, content, applyStep as ReviewStep);
    } catch (e: any) {
      setError(e?.message || 'Could not save content');
    } finally {
      setBusy(null);
    }
  };

  const toggleClose = async (reopen: boolean) => {
    if (!selected) return;
    setBusy('close');
    setError(null);
    try {
      await draftService.reviewClose(draftId, selected.topicId, selected.subtopicId, reopen);
      const newStep: ReviewStep = reopen ? 'review' : 'closed';
      setStepOverrides((prev) => ({ ...prev, [selected.key]: newStep }));
      onContentApplied(selected.topicId, selected.subtopicId, editContent, newStep);
    } catch (e: any) {
      setError(e?.message || 'Could not update section status');
    } finally {
      setBusy(null);
    }
  };

  if (!selected) {
    return <Alert severity="info">No sections to review. Approve a TOC first.</Alert>;
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, height: 'calc(100vh - 250px)', minHeight: 460 }}>
      {/* LEFT — section list, color-coded by provenance (kept / added) like the TOC map view */}
      <Paper variant="outlined" sx={{ width: 260, flexShrink: 0, overflowY: 'auto', p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
            SECTIONS
          </Typography>
          <Chip
            size="small"
            label={`${closedCount}/${units.length} done`}
            sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#ecfdf5', color: '#047857' }}
          />
        </Box>
        {units.map((u) => {
          const pv = provOf(u);
          const isClosed = stepOf(u) === 'closed';
          const sel = u.key === selectedKey;
          return (
            <Box
              key={u.key}
              onClick={() => setSelectedKey(u.key)}
              sx={{
                cursor: 'pointer',
                px: 1,
                py: 0.6,
                my: 0.3,
                ml: u.isSubtopic ? 1.5 : 0,
                borderRadius: 1,
                bgcolor: PROV[pv].bg,
                border: sel ? `1px solid ${PROV[pv].color}` : '1px solid transparent',
                '&:hover': { filter: 'brightness(0.98)' },
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: PROV[pv].color, flexShrink: 0 }} />
              <Typography
                variant="body2"
                sx={{
                  flex: 1, minWidth: 0,
                  fontSize: u.isSubtopic ? '0.78rem' : '0.84rem',
                  fontWeight: u.isSubtopic ? 400 : 600,
                  color: '#1e293b',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {u.label}. {u.title}
              </Typography>
              {isClosed ? (
                <CheckCircle sx={{ fontSize: 15, color: '#10b981', flexShrink: 0 }} />
              ) : (
                <Typography variant="caption" sx={{ color: PROV[pv].color, fontWeight: 600, flexShrink: 0 }}>
                  {PROV[pv].label}
                </Typography>
              )}
            </Box>
          );
        })}

        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1.5, px: 1 }}>
          {(['kept', 'added'] as Provenance[]).map((p) => (
            <Box key={p} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: PROV[p].color }} />
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>{PROV[p].label}</Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <CheckCircle sx={{ fontSize: 12, color: '#10b981' }} />
            <Typography variant="caption" sx={{ color: '#94a3b8' }}>done</Typography>
          </Box>
        </Box>
      </Paper>

      {/* CENTER — pipeline (scrolls) + pinned chatbot */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
        {/* Scrollable pipeline area */}
        <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, pr: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem' }}>
            {selected.label}. {selected.title}
          </Typography>
          <Chip
            size="small"
            label={PROV[provOf(selected)].label}
            sx={{ bgcolor: PROV[provOf(selected)].bg, color: PROV[provOf(selected)].color, fontWeight: 600, textTransform: 'capitalize' }}
          />
        </Box>

        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

        {locked && (
          <Alert
            severity="success"
            action={
              <Button color="inherit" size="small" disabled={!!busy} onClick={() => toggleClose(true)}>
                Reopen
              </Button>
            }
          >
            This section is marked done — reopen it to make changes.
          </Alert>
        )}

        {/* Timeline — Benchmark → Regulation → Finalize. Click any step to go back/forward. */}
        <Stepper nonLinear activeStep={activeStep} alternativeLabel sx={{ '& .MuiStepLabel-label': { fontSize: '0.75rem', mt: 0.5 } }}>
          {STEPS.map((label, i) => (
            <Step key={label} completed={i < completedThrough(selectedStep)}>
              <StepButton color="inherit" onClick={() => setActiveStep(i)}>{label}</StepButton>
            </Step>
          ))}
        </Stepper>

        {preview ? (
          /* A previewed change overrides the step panel until confirmed/discarded */
          <Paper variant="outlined" sx={{ p: 1.5, borderColor: '#667eea' }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#667eea' }}>
              PREVIEW — {preview.label}
            </Typography>
            <Box sx={{ maxHeight: 260, overflowY: 'auto', my: 1, p: 1, bgcolor: '#fff', borderRadius: 1 }}>
              <DiffView current={editContent} proposed={preview.content} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="contained"
                disabled={busy === 'apply' || locked}
                onClick={() => applyContent(preview.content, preview.step)}
                sx={GRADIENT_BTN}
              >
                {busy === 'apply' ? 'Saving…' : 'Apply'}
              </Button>
              <Button size="small" variant="outlined" disabled={busy === 'apply'} onClick={() => setPreview(null)}>
                Discard
              </Button>
            </Box>
          </Paper>
        ) : (
          <>
            {/* STEP 1 — BENCHMARK */}
            {activeStep === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant={benchmark ? 'outlined' : 'contained'}
                    startIcon={<LibraryBooks />}
                    disabled={!!busy || locked || !hasBaselineContent}
                    onClick={runBenchmark}
                    sx={benchmark ? undefined : GRADIENT_BTN}
                  >
                    {busy === 'benchmark' ? 'Reviewing…' : benchmark ? 'Re-run benchmark' : 'Run benchmark review'}
                  </Button>
                </Box>

                {!hasBaselineContent && (
                  <Alert severity="info" sx={{ py: 0.25 }}>
                    No client baseline content detected for this section — there's nothing to benchmark against.
                  </Alert>
                )}

                {/* Manual benchmark override — always available; overrides auto-matching for this section
                    (useful when nothing was matched, or the auto-match is wrong). */}
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<LibraryBooks />}
                      disabled={locked}
                      onClick={() => {
                        // Seed the editor from the benchmark text currently in use so it can be edited.
                        if (!manualOpen) setManualBench((prev) => prev || benchmark?.benchmark_content || '');
                        setManualOpen((o) => !o);
                      }}
                      sx={{ textTransform: 'none', color: '#667eea' }}
                    >
                      {benchmark?.benchmark_match === 'Manual benchmark' ? 'Edit manual benchmark' : 'Provide benchmark manually'}
                    </Button>
                    {benchmark?.benchmark_match === 'Manual benchmark' && (
                      <Chip size="small" label="Manual benchmark in use" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#eef2ff', color: '#4338ca' }} />
                    )}
                    {benchmark && benchmark.benchmark_match !== 'Manual benchmark' && !benchmark.benchmark_content && (
                      <Chip size="small" label="No benchmark matched" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#fef2f2', color: '#b91c1c' }} />
                    )}
                  </Box>
                  {manualOpen && (
                    <Box sx={{ mt: 1 }}>
                      <TextField
                        multiline minRows={5} fullWidth size="small"
                        placeholder="Paste the benchmark text to test this section against. Leave empty to use the auto-matched benchmark."
                        value={manualBench}
                        onChange={(e) => setManualBench(e.target.value)}
                        disabled={!!busy || locked}
                      />
                      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Button
                          size="small" variant="contained" sx={GRADIENT_BTN}
                          disabled={!!busy || locked || !manualBench.trim()}
                          onClick={() => saveManualBench(false)}
                        >
                          {busy === 'manualbench' ? 'Saving…' : 'Save & re-run'}
                        </Button>
                        <Button
                          size="small" variant="outlined"
                          disabled={!!busy || locked}
                          onClick={() => saveManualBench(true)}
                        >
                          Clear override
                        </Button>
                        <Button size="small" variant="text" disabled={!!busy} onClick={() => setManualOpen(false)}>
                          Cancel
                        </Button>
                      </Box>
                    </Box>
                  )}
                </Box>

                {benchmark && (
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#fafbff' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                      BENCHMARK GAP ASSESSMENT {benchmark.benchmark_match ? `(matched: ${benchmark.benchmark_match})` : ''}
                    </Typography>
                    {benchmark.findings.length === 0 ? (
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#64748b', my: 0.5 }}>
                        No gaps found — the baseline already aligns with the benchmark.
                      </Typography>
                    ) : (
                      benchmark.findings.map((f) => (
                        <Box
                          key={f.id}
                          sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start', mt: 1, p: 1, bgcolor: '#fff', borderRadius: 1, border: '1px solid #eef2f7' }}
                        >
                          <Checkbox
                            size="small" sx={{ p: 0.25 }}
                            checked={!!checkedFindings[f.id]}
                            onChange={(e) => setCheckedFindings((prev) => ({ ...prev, [f.id]: e.target.checked }))}
                          />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                              <Chip size="small" label={TYPE_LABEL[f.type] || f.type} sx={{ height: 18, fontSize: '0.6rem' }} />
                              <Chip
                                size="small" label={f.severity}
                                sx={{ height: 18, fontSize: '0.6rem', bgcolor: `${SEVERITY_COLOR[f.severity] || '#94a3b8'}22`, color: SEVERITY_COLOR[f.severity] || '#475569', textTransform: 'capitalize' }}
                              />
                            </Box>
                            <Typography variant="body2" sx={{ fontSize: '0.8rem', mt: 0.25, color: '#1e293b' }}>{f.description}</Typography>
                            {f.suggested_change && (
                              <Typography variant="body2" sx={{ fontSize: '0.78rem', mt: 0.25, color: '#334155' }}>
                                <b>Suggested change:</b> {f.suggested_change}
                              </Typography>
                            )}
                            {f.evidence && (
                              <Typography variant="body2" sx={{ fontSize: '0.74rem', mt: 0.25, color: '#64748b', fontStyle: 'italic' }}>
                                Evidence: “{f.evidence}”{f.evidence_source ? ` — ${f.evidence_source}` : ''}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      ))
                    )}
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={!!busy || locked || benchmark.findings.filter((f) => checkedFindings[f.id]).length === 0}
                        onClick={tweakSelected}
                        sx={GRADIENT_BTN}
                      >
                        {busy === 'tweak' ? 'Preparing…' : 'Fix gaps'}
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={!benchmark.as_is_suggestion || !!busy || locked}
                        onClick={() => setPreview({ content: benchmark.as_is_suggestion, step: 'benchmark', label: 'Use benchmark as-is' })}
                      >
                        Use benchmark as-is
                      </Button>
                    </Box>
                  </Paper>
                )}

                <Box>
                  <Button size="small" onClick={() => setActiveStep(1)} sx={{ textTransform: 'none' }}>
                    Continue to regulations →
                  </Button>
                </Box>
              </Box>
            )}

            {/* STEP 2 — REGULATION */}
            {activeStep === 1 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Button
                    size="small"
                    variant={reg ? 'outlined' : 'contained'}
                    startIcon={<Gavel />}
                    disabled={!!busy || locked}
                    onClick={runRegulation}
                    sx={reg ? undefined : GRADIENT_BTN}
                  >
                    {busy === 'regulation' ? 'Checking…' : reg ? 'Re-check regulations' : 'Check regulations'}
                  </Button>
                  {/* Draft-scoped: attach more regulation files so the check has something to retrieve from. */}
                  <input
                    ref={regFileRef}
                    type="file"
                    accept=".docx"
                    multiple
                    hidden
                    onChange={(e) => uploadRegs(e.target.files)}
                  />
                  <Button
                    size="small"
                    variant="text"
                    startIcon={<UploadFile />}
                    disabled={!!busy}
                    onClick={() => regFileRef.current?.click()}
                    sx={{ textTransform: 'none' }}
                  >
                    {busy === 'regupload' ? 'Uploading…' : 'Upload regulations'}
                  </Button>
                </Box>
                {regsMsg && (
                  <Typography variant="caption" sx={{ color: '#047857' }}>{regsMsg}</Typography>
                )}

                {reg && (
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: reg.applies ? '#fffbeb' : '#f8fafc' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
                      REGULATION CHECK
                    </Typography>
                    {!reg.has_regulations ? (
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#64748b', my: 0.5 }}>
                        No regulations loaded for this draft. Use <b>Upload regulations</b> above to attach
                        regulation files, then run the check.
                      </Typography>
                    ) : reg.applies ? (
                      <>
                        {reg.extract && (
                          <Typography variant="body2" sx={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#92400e', my: 0.5 }}>
                            “{reg.extract}”
                          </Typography>
                        )}
                        {reg.suggestion && (
                          <Typography variant="body2" sx={{ fontSize: '0.82rem', color: '#334155', my: 0.5 }}>
                            {reg.suggestion}
                          </Typography>
                        )}
                        <Button
                          size="small"
                          variant="contained"
                          disabled={!reg.suggestion || !!busy || locked}
                          onClick={() =>
                            setPreview({
                              content: `${editContent.trim()}\n\n${reg.suggestion}`.trim(),
                              step: 'regulation',
                              label: 'Embed regulation clause',
                            })
                          }
                          sx={{ ...GRADIENT_BTN, mt: 0.5 }}
                        >
                          Embed clause
                        </Button>
                      </>
                    ) : (
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#64748b', my: 0.5 }}>
                        No applicable regulation found for this section.
                      </Typography>
                    )}
                  </Paper>
                )}

                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={() => setActiveStep(0)} sx={{ textTransform: 'none' }}>← Back</Button>
                  <Button size="small" onClick={() => setActiveStep(2)} sx={{ textTransform: 'none' }}>Continue to finalize →</Button>
                </Box>
              </Box>
            )}

            {/* STEP 3 — FINALIZE (mark as done) */}
            {activeStep === 2 && (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {selectedStep === 'closed' ? (
                  <Button size="small" color="warning" variant="outlined" disabled={!!busy} onClick={() => toggleClose(true)}>
                    Reopen
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<CheckCircle />}
                    disabled={!!busy}
                    onClick={() => toggleClose(false)}
                    sx={GRADIENT_BTN}
                  >
                    Mark as done
                  </Button>
                )}
                <Box sx={{ flex: 1 }} />
                <Button size="small" onClick={() => setActiveStep(1)} sx={{ textTransform: 'none' }}>← Back to regulations</Button>
              </Box>
            )}

            {/* Section content — editable in EVERY step (benchmark / regulation / finalize) */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>SECTION CONTENT</Typography>
              <TextField
                multiline
                minRows={7}
                maxRows={16}
                fullWidth
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                disabled={locked}
                sx={{ '& textarea': { fontSize: '0.85rem', lineHeight: 1.6 } }}
              />
              <Box>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={busy === 'apply' || locked || editContent === selected.content}
                  onClick={() => applyContent(editContent, 'review')}
                >
                  {busy === 'apply' ? 'Saving…' : 'Save edits'}
                </Button>
              </Box>
            </Box>
          </>
        )}
        </Box>

        {/* Per-section chatbot — pinned to the bottom of the column */}
        <Box sx={{ flexShrink: 0 }}>
        <Divider sx={{ my: 0.5 }} />
        <Box>
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569' }}>
            ASK THE ASSISTANT
          </Typography>
          <Box sx={{ maxHeight: 180, overflowY: 'auto', my: 0.5 }}>
            {chat.map((m, i) => (
              <Box key={i} sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#4338ca' }}>
                  You: {m.user}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '0.82rem', color: '#334155', whiteSpace: 'pre-wrap' }}>
                  {m.ai}
                </Typography>
              </Box>
            ))}
            <div ref={chatEndRef} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="e.g. keep only the first 3 bullets, or merge in the benchmark wording"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendChat();
                }
              }}
              disabled={busy === 'chat' || locked}
            />
            <Button
              size="small"
              variant="contained"
              disabled={busy === 'chat' || locked || !chatInput.trim()}
              onClick={sendChat}
              sx={{ ...GRADIENT_BTN, minWidth: 44 }}
            >
              {busy === 'chat' ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <Send sx={{ fontSize: 18, color: '#fff' }} />}
            </Button>
          </Box>
        </Box>
        </Box>
      </Box>

      {/* RIGHT — references */}
      <Paper variant="outlined" sx={{ width: 300, flexShrink: 0, overflowY: 'auto', p: 1.5 }}>
        {/* The section's current/confirmed content (reflects everything applied so far) */}
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <CheckCircle sx={{ fontSize: 13, color: '#10b981' }} /> CURRENT CONTENT
        </Typography>
        <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#1e293b', whiteSpace: 'pre-wrap', mt: 0.5, mb: 1.5 }}>
          {editContent || '(nothing confirmed yet — apply a benchmark/regulation change or edit in Finalize)'}
        </Typography>

        <Divider sx={{ my: 1 }} />

        <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Lock sx={{ fontSize: 13 }} /> CLIENT BASELINE
        </Typography>
        <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#475569', whiteSpace: 'pre-wrap', mt: 0.5, mb: 1.5 }}>
          {selected.baseline || '(no baseline content captured — map client content in the TOC tab)'}
        </Typography>

        {benchmark && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LibraryBooks sx={{ fontSize: 13 }} /> BENCHMARK
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#475569', whiteSpace: 'pre-wrap', mt: 0.5, mb: 1.5 }}>
              {benchmark.benchmark_content || '(no benchmark match)'}
            </Typography>
          </>
        )}

        {reg?.applies && reg.extract && (
          <>
            <Divider sx={{ my: 1 }} />
            <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Gavel sx={{ fontSize: 13 }} /> REGULATION
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#92400e', whiteSpace: 'pre-wrap', mt: 0.5, fontStyle: 'italic' }}>
              {reg.extract}
            </Typography>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default ReviewPipelinePanel;
