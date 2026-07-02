import React, { useRef, useState } from 'react';
import {
  Button,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  TextField,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import { AccountTree, Add, DeleteOutline, Lock, Save as SaveIcon } from '@mui/icons-material';
import { draftService } from '../services/draftService';

const PURPLE_GRADIENT = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
const UNASSIGNED = 'unassigned';
const UNPLACED_VIEW = '__unplaced__';

type Status = 'added' | 'kept' | 'merged';

// Dot/word color + row background tint per status.
const STATUS = {
  added: { color: '#10b981', bg: '#ecfdf5' },   // green — new section, no client content
  kept: { color: '#2563eb', bg: '#eff6ff' },    // blue — one client source
  merged: { color: '#d97706', bg: '#fffbeb' },  // amber — several client sources combined
};
const UNPLACED_COLOR = '#dc2626';

interface RSource {
  id: number;
  title: string;
  content: string;
  level: 'topic' | 'subtopic';
}

interface RTarget {
  key: string;
  topic_id: string;
  subtopic_id: string | null;
  title: string;
  level: 'topic' | 'subtopic';
  isNew?: boolean;
  added?: boolean; // origin: added from the benchmark (vs a client-policy section)
}

interface Props {
  draftId: string;
  // Called after a successful save so the parent can reload the draft.
  onApplied: () => void;
  size?: 'small' | 'medium';
  disabled?: boolean;
  // Show a "Save & approve TOC" action in the dialog (hidden once the TOC is already approved).
  showApprove?: boolean;
}

/**
 * Full editor for mapping the client's ORIGINAL content into the Good TOC. Left = the final structure
 * (color-coded by status: added / kept / merged) + an Unplaced tray; right = rename, add/remove, and edit
 * each section's content, then Save. Saving rebuilds the Good TOC and sets content + baseline. Lives in the
 * TOC tab; self-contained so the layout can be swapped without touching anything else.
 */
const RedistributeButton: React.FC<Props> = ({ draftId, onApplied, size = 'small', disabled = false, showApprove = false }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [sources, setSources] = useState<RSource[]>([]);
  const [targets, setTargets] = useState<RTarget[]>([]);
  const [assignment, setAssignment] = useState<Record<string, string>>({});
  const [content, setContent] = useState<Record<string, string>>({});
  // Baselines captured at load, used to detect unsaved changes (drives the Save button).
  const [savedContent, setSavedContent] = useState<Record<string, string>>({}); // section content as currently in the draft
  const [savedTitles, setSavedTitles] = useState<Record<string, string>>({});
  const [savedKeys, setSavedKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>(UNPLACED_VIEW);
  const [error, setError] = useState<string | null>(null);
  const newCounter = useRef(0);

  const openDialog = async () => {
    setOpen(true);
    setLoading(true);
    setError(null);
    setTargets([]);
    try {
      const p = await draftService.proposeRedistribution(draftId);
      const asg = { ...p.assignments };
      const tg: RTarget[] = p.targets.map((t) => ({
        key: t.key, topic_id: t.topic_id, subtopic_id: t.subtopic_id, title: t.title, level: t.level, isNew: false,
        added: !!t.added_from_benchmark,
      }));
      const buf: Record<string, string> = {};
      const cur: Record<string, string> = {};
      const titles: Record<string, string> = {};
      p.targets.forEach((t) => {
        const composed = p.sources
          .filter((s) => (asg[String(s.id)] || UNASSIGNED) === t.key)
          .map((s) => (s.content || '').trim())
          .filter(Boolean)
          .join('\n\n')
          .trim();
        const current = (t.current_content || '').trim();
        // Editable buffer = the section's saved content, else the mapping's composed content (seeds empties).
        buf[t.key] = current || composed;
        cur[t.key] = current;
        titles[t.key] = t.title;
      });
      setSources(p.sources);
      setTargets(tg);
      setAssignment(asg);
      setContent(buf);
      setSavedContent(cur);
      setSavedTitles(titles);
      setSavedKeys(tg.map((t) => t.key));
      setSelectedKey(tg[0]?.key || UNPLACED_VIEW);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not propose a mapping.');
    } finally {
      setLoading(false);
    }
  };

  const sourcesFor = (key: string) => sources.filter((s) => (assignment[String(s.id)] || UNASSIGNED) === key);
  const unplaced = () => sources.filter((s) => (assignment[String(s.id)] || UNASSIGNED) === UNASSIGNED);
  const statusOf = (key: string): Status => {
    const n = sourcesFor(key).length;
    if (n >= 2) return 'merged';        // several client sources combined here
    if (n === 1) return 'kept';         // one client source
    // 0 client sources mapped: origin decides. A client-policy section (e.g. a parent topic whose
    // content lives in its subtopics) is "kept" — it's from the client, just empty here. Only a
    // benchmark-added section or a brand-new one the reviewer created is truly "added".
    const t = targets.find((x) => x.key === key);
    return (!t || t.isNew || t.added) ? 'added' : 'kept';
  };

  const placeSource = (sourceId: number, key: string) => {
    const src = sources.find((s) => s.id === sourceId);
    if (!src) return;
    setAssignment((prev) => ({ ...prev, [String(sourceId)]: key }));
    setContent((prev) => {
      const existing = (prev[key] || '').trim();
      return { ...prev, [key]: existing ? `${existing}\n\n${(src.content || '').trim()}` : (src.content || '').trim() };
    });
  };

  const rename = (key: string, title: string) =>
    setTargets((prev) => prev.map((t) => (t.key === key ? { ...t, title } : t)));

  const addTopic = () => {
    const key = `new_${newCounter.current++}`;
    setTargets((prev) => [...prev, { key, topic_id: '', subtopic_id: null, title: 'New section', level: 'topic', isNew: true }]);
    setContent((prev) => ({ ...prev, [key]: '' }));
    setSelectedKey(key);
  };

  const addSubtopic = (parentKey: string) => {
    const key = `new_${newCounter.current++}`;
    setTargets((prev) => {
      const idx = prev.findIndex((t) => t.key === parentKey);
      if (idx === -1) return prev;
      let insertAt = idx + 1;
      while (insertAt < prev.length && prev[insertAt].level === 'subtopic') insertAt++;
      const copy = [...prev];
      copy.splice(insertAt, 0, { key, topic_id: '', subtopic_id: '', title: 'New subsection', level: 'subtopic', isNew: true });
      return copy;
    });
    setContent((prev) => ({ ...prev, [key]: '' }));
    setSelectedKey(key);
  };

  // A section's content is "changed" vs the draft when its buffer differs from the saved content.
  const contentChanged = (key: string) => (content[key] || '').trim() !== (savedContent[key] || '').trim();

  // Anything to save? new/removed sections, a rename, content edits, or a freshly-seeded empty section.
  const hasChanges = (): boolean => {
    if (targets.some((t) => t.isNew)) return true;
    if (savedKeys.some((k) => !targets.find((t) => t.key === k))) return true; // a section was removed
    if (targets.some((t) => !t.isNew && t.title !== (savedTitles[t.key] ?? t.title))) return true; // renamed
    return targets.some((t) => contentChanged(t.key)); // content edited or seeded
  };

  const removeTarget = (key: string) => {
    setTargets((prev) => {
      const idx = prev.findIndex((t) => t.key === key);
      if (idx === -1) return prev;
      const removed = [key];
      let end = idx + 1;
      if (prev[idx].level === 'topic') {
        while (end < prev.length && prev[end].level === 'subtopic') { removed.push(prev[end].key); end++; }
      }
      // Send any client content that was in the removed sections back to Unplaced.
      setAssignment((a) => {
        const next = { ...a };
        Object.keys(next).forEach((sid) => { if (removed.includes(next[sid])) next[sid] = UNASSIGNED; });
        return next;
      });
      return prev.filter((t) => !removed.includes(t.key));
    });
    if (selectedKey === key) setSelectedKey(UNPLACED_VIEW);
  };

  const save = async (approve = false) => {
    setSaving(true);
    setApproving(approve);
    setError(null);
    try {
      const payload = targets.map((t) => ({
        level: t.level,
        id: t.isNew ? '' : (t.level === 'topic' ? t.topic_id : (t.subtopic_id || '')),
        title: t.title,
        content: content[t.key] || '',
        // Only overwrite a section's content when it actually changed; untouched sections keep theirs.
        include: t.isNew || contentChanged(t.key),
      }));
      await draftService.commitRedistribution(draftId, payload);
      // "Save & approve" locks the TOC in the same flow — the mapping was just committed, so the
      // approve gate (content_mapped) is satisfied.
      if (approve) await draftService.approveToc(draftId);
      setOpen(false);
      onApplied();
    } catch (e: any) {
      setError(e?.response?.data?.detail || (approve ? 'Saved the mapping but could not approve the TOC.' : 'Could not save.'));
    } finally {
      setSaving(false);
      setApproving(false);
    }
  };

  const unplacedList = unplaced();
  const selectedTarget = targets.find((t) => t.key === selectedKey) || null;

  return (
    <>
      <Button
        variant="outlined"
        size={size}
        startIcon={<AccountTree sx={{ fontSize: 16 }} />}
        onClick={openDialog}
        disabled={disabled}
        sx={{ textTransform: 'none', fontWeight: 600 }}
      >
        Map client content → sections
      </Button>

      <Dialog open={open} onClose={() => !saving && setOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Map client content into sections</DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {error && <Typography variant="body2" sx={{ color: '#b91c1c', p: 2, pb: 0 }}>{error}</Typography>}
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 3 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">Matching the client's original content to your sections…</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', height: '64vh', minHeight: 440 }}>
              {/* LEFT — editable final TOC + Unplaced tray */}
              <Box sx={{ width: 360, flexShrink: 0, borderRight: '1px solid #e2e8f0', overflowY: 'auto', p: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#475569', px: 1 }}>FINAL SECTIONS</Typography>
                {targets.map((t) => {
                  const st = statusOf(t.key);
                  const n = sourcesFor(t.key).length;
                  const sel = selectedKey === t.key;
                  return (
                    <Box
                      key={t.key}
                      onClick={() => setSelectedKey(t.key)}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer',
                        px: 1, py: 0.6, my: 0.3, borderRadius: 1, ml: t.level === 'subtopic' ? 2 : 0,
                        bgcolor: STATUS[st].bg,
                        border: sel ? `1px solid ${STATUS[st].color}` : '1px solid transparent',
                        '&:hover .rm': { visibility: 'visible' },
                      }}
                    >
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: STATUS[st].color, flexShrink: 0 }} />
                      <Typography
                        variant="body2"
                        sx={{
                          flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontWeight: t.level === 'topic' ? 600 : 400, fontSize: t.level === 'subtopic' ? '0.78rem' : '0.84rem',
                        }}
                      >
                        {t.title || '(untitled)'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: STATUS[st].color, fontWeight: 600, flexShrink: 0 }}>
                        {st === 'merged' ? `merged ${n}` : st}
                      </Typography>
                      <Tooltip title="Remove">
                        <IconButton
                          className="rm" size="small"
                          sx={{ p: 0.25, visibility: 'hidden' }}
                          onClick={(e) => { e.stopPropagation(); removeTarget(t.key); }}
                        >
                          <DeleteOutline sx={{ fontSize: 15, color: '#dc2626' }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  );
                })}

                <Button size="small" startIcon={<Add />} onClick={addTopic} sx={{ mt: 0.5, textTransform: 'none' }}>
                  Add topic
                </Button>

                <Divider sx={{ my: 1 }} />
                <Box
                  onClick={() => setSelectedKey(UNPLACED_VIEW)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 0.75, cursor: 'pointer', px: 1, py: 0.6, borderRadius: 1,
                    bgcolor: selectedKey === UNPLACED_VIEW ? '#fef2f2' : 'transparent', '&:hover': { bgcolor: '#fef2f2' },
                  }}
                >
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: UNPLACED_COLOR, flexShrink: 0 }} />
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 600, color: UNPLACED_COLOR }}>Unplaced content</Typography>
                  <Chip size="small" label={unplacedList.length} sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#fee2e2', color: UNPLACED_COLOR }} />
                </Box>

                <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1.5, px: 1 }}>
                  {(['added', 'kept', 'merged'] as Status[]).map((s) => (
                    <Box key={s} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: STATUS[s].color }} />
                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>{s}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* RIGHT — editor */}
              <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', p: 2 }}>
                {selectedKey === UNPLACED_VIEW ? (
                  <>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: UNPLACED_COLOR, mb: 1 }}>
                      Unplaced content ({unplacedList.length})
                    </Typography>
                    {unplacedList.length === 0 ? (
                      <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                        Nothing unplaced — every piece of the client's content is mapped to a section.
                      </Typography>
                    ) : (
                      unplacedList.map((s) => (
                        <Box key={s.id} sx={{ mb: 1.5, pb: 1.5, borderBottom: '1px solid #f1f5f9' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Chip size="small" label={s.level} sx={{ height: 18, fontSize: '0.6rem', textTransform: 'capitalize' }} />
                            <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>{s.title}</Typography>
                            <Select
                              size="small" displayEmpty value="" sx={{ minWidth: 180, fontSize: '0.78rem' }}
                              onChange={(e) => e.target.value && placeSource(s.id, e.target.value)}
                            >
                              <MenuItem value="" disabled><em>Send to section…</em></MenuItem>
                              {targets.map((t) => (
                                <MenuItem key={t.key} value={t.key} sx={{ pl: t.level === 'subtopic' ? 4 : 2, fontWeight: t.level === 'topic' ? 600 : 400 }}>
                                  {t.level === 'subtopic' ? `— ${t.title}` : t.title}
                                </MenuItem>
                              ))}
                            </Select>
                          </Box>
                          <Typography variant="body2" sx={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'pre-wrap', maxHeight: 90, overflow: 'auto' }}>
                            {s.content}
                          </Typography>
                        </Box>
                      ))
                    )}
                  </>
                ) : selectedTarget ? (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <TextField
                        size="small" variant="standard" fullWidth value={selectedTarget.title}
                        onChange={(e) => rename(selectedTarget.key, e.target.value)}
                        InputProps={{ sx: { fontWeight: 700, fontSize: '0.95rem' } }}
                      />
                      <Chip
                        size="small" label={statusOf(selectedTarget.key)}
                        sx={{ bgcolor: STATUS[statusOf(selectedTarget.key)].bg, color: STATUS[statusOf(selectedTarget.key)].color, fontWeight: 600, textTransform: 'capitalize' }}
                      />
                      {selectedTarget.level === 'topic' && (
                        <Tooltip title="Add subsection">
                          <IconButton size="small" onClick={() => addSubtopic(selectedTarget.key)}><Add sx={{ fontSize: 18 }} /></IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Remove section">
                        <IconButton size="small" onClick={() => removeTarget(selectedTarget.key)}><DeleteOutline sx={{ fontSize: 18, color: '#dc2626' }} /></IconButton>
                      </Tooltip>
                    </Box>

                    {sourcesFor(selectedTarget.key).length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                        <Typography variant="caption" sx={{ color: '#94a3b8', mr: 0.5 }}>from:</Typography>
                        {sourcesFor(selectedTarget.key).map((s) => (
                          <Chip key={s.id} size="small" label={s.title} sx={{ height: 20, fontSize: '0.65rem' }} />
                        ))}
                      </Box>
                    )}

                    <TextField
                      multiline minRows={10} maxRows={20} fullWidth
                      value={content[selectedTarget.key] || ''}
                      onChange={(e) => setContent((prev) => ({ ...prev, [selectedTarget.key]: e.target.value }))}
                      placeholder="No content yet — pull pieces from Unplaced or type here."
                      sx={{ '& textarea': { fontSize: '0.84rem', lineHeight: 1.6 } }}
                    />

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                      {unplacedList.length > 0 && (
                        <Select
                          size="small" displayEmpty value="" sx={{ minWidth: 210, fontSize: '0.8rem' }}
                          onChange={(e) => e.target.value && placeSource(Number(e.target.value), selectedTarget.key)}
                        >
                          <MenuItem value="" disabled><em>+ Pull from Unplaced…</em></MenuItem>
                          {unplacedList.map((s) => (
                            <MenuItem key={s.id} value={String(s.id)} sx={{ fontSize: '0.8rem' }}>{s.title}</MenuItem>
                          ))}
                        </Select>
                      )}
                      <Box sx={{ flex: 1 }} />
                      <Button
                        size="small" variant="contained" startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
                        onClick={() => save()} disabled={saving || !hasChanges()}
                        sx={{ background: PURPLE_GRADIENT, color: '#fff', textTransform: 'none', '&.Mui-disabled': { color: '#fff', opacity: 0.55 } }}
                      >
                        {saving && !approving ? 'Saving…' : 'Save'}
                      </Button>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body2" sx={{ color: '#94a3b8' }}>Select a section.</Typography>
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button
            variant="contained" onClick={() => save()} disabled={saving || loading || !hasChanges()}
            sx={{ background: PURPLE_GRADIENT, color: '#fff', '&.Mui-disabled': { color: '#fff', opacity: 0.55 } }}
          >
            {saving && !approving ? 'Saving…' : 'Save all'}
          </Button>
          {showApprove && (
            <Tooltip title="Save this mapping and lock the TOC as the agreed structure (Approve TOC)">
              <span>
                <Button
                  variant="contained" startIcon={approving ? <CircularProgress size={14} color="inherit" /> : <Lock sx={{ fontSize: 16 }} />}
                  onClick={() => save(true)} disabled={saving || loading}
                  sx={{ background: PURPLE_GRADIENT, color: '#fff', '&.Mui-disabled': { color: '#fff', opacity: 0.55 } }}
                >
                  {approving ? 'Approving…' : 'Save & approve TOC'}
                </Button>
              </span>
            </Tooltip>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RedistributeButton;
