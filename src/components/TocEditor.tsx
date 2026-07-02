import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import {
  Edit,
  Delete,
  Add,
  DragIndicator,
  ExpandMore,
  ExpandLess,
  Save,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Draft, TOCTopic } from '../types/draft.types';

// ----- The same drag-and-drop TOC cards used by the second-row Table of Contents editor. -----

interface SortableTopicProps {
  topic: Draft['toc'][0];
  index: number;
  editingTopic: { id: string; text: string; isSubtopic: boolean } | null;
  expandedTopics: Set<string>;
  onToggleExpansion: (topicId: string) => void;
  onEditTopic: (id: string, text: string, isSubtopic: boolean) => void;
  onDeleteTopic: (id: string, isSubtopic: boolean) => void;
  onSaveEdit: () => void;
  setEditingTopic: (topic: { id: string; text: string; isSubtopic: boolean } | null) => void;
  onAddSubtopic: (topicId: string, subtopicText: string) => void;
}

interface SortableSubtopicProps {
  subtopic: Draft['toc'][0]['subtopics'][0];
  topicIndex: number;
  subIndex: number;
  editingTopic: { id: string; text: string; isSubtopic: boolean } | null;
  onEditTopic: (id: string, text: string, isSubtopic: boolean) => void;
  onDeleteTopic: (id: string, isSubtopic: boolean) => void;
  onSaveEdit: () => void;
  setEditingTopic: (topic: { id: string; text: string; isSubtopic: boolean } | null) => void;
}

export function SortableSubtopic({
  subtopic,
  topicIndex,
  subIndex,
  editingTopic,
  onEditTopic,
  onDeleteTopic,
  onSaveEdit,
  setEditingTopic,
}: SortableSubtopicProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtopic.subtopic_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={0}
      sx={{
        mb: 0.5,
        py: 0.5,
        px: 1.25,
        border: '1px solid #e2e8f0',
        borderRadius: 1,
        background: 'white',
        '&:hover': {
          borderColor: '#cbd5e0',
        },
      }}
    >
      <Box display="flex" alignItems="center" gap={1}>
        <Tooltip title="Drag to reorder subtopic">
          <DragIndicator
            sx={{ color: '#cbd5e0', cursor: 'grab', fontSize: 14 }}
            {...attributes}
            {...listeners}
          />
        </Tooltip>

        <Typography
          sx={{
            color: '#667eea',
            fontWeight: 600,
            fontSize: '0.7rem',
            minWidth: '32px',
          }}
        >
          {topicIndex + 1}.{subIndex + 1}
        </Typography>

        {editingTopic?.id === subtopic.subtopic_id && editingTopic.isSubtopic ? (
          <TextField
            fullWidth
            value={editingTopic.text}
            onChange={(e) => setEditingTopic({ ...editingTopic, text: e.target.value })}
            onKeyPress={(e) => e.key === 'Enter' && onSaveEdit()}
            onBlur={onSaveEdit}
            autoFocus
            variant="outlined"
            size="small"
            sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5 } }}
          />
        ) : (
          <Typography
            sx={{
              flexGrow: 1,
              color: '#4a5568',
              fontWeight: 500,
              fontSize: '0.75rem',
            }}
          >
            {subtopic.topic}
          </Typography>
        )}

        {subtopic.added_from_benchmark && (
          <Tooltip title={subtopic.benchmark_match ? `Added from benchmark: ${subtopic.benchmark_match}` : 'Added from the benchmark'}>
            <Chip
              label="added"
              size="small"
              sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, bgcolor: '#dcfce7', color: '#15803d' }}
            />
          </Tooltip>
        )}

        <Box display="flex" gap={0.25}>
          <Tooltip title="Edit subtopic">
            <IconButton
              size="small"
              onClick={() => onEditTopic(subtopic.subtopic_id, subtopic.topic, true)}
              sx={{ color: '#10b981', p: 0.25 }}
            >
              <Edit sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete subtopic">
            <IconButton
              size="small"
              onClick={() => onDeleteTopic(subtopic.subtopic_id, true)}
              sx={{ color: '#ef4444', p: 0.25 }}
            >
              <Delete sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
}

export function SortableTopic({
  topic,
  index,
  editingTopic,
  expandedTopics,
  onToggleExpansion,
  onEditTopic,
  onDeleteTopic,
  onSaveEdit,
  setEditingTopic,
  onAddSubtopic,
  onSubtopicDragEnd,
}: SortableTopicProps & { onSubtopicDragEnd: (event: DragEndEvent, topicId: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: topic.topic_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const subtopicSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleSubtopicDragEnd = (event: DragEndEvent) => {
    onSubtopicDragEnd(event, topic.topic_id);
  };

  const [showAddSubtopic, setShowAddSubtopic] = useState(false);
  const [newSubtopicText, setNewSubtopicText] = useState('');

  const handleAddSubtopic = () => {
    if (newSubtopicText.trim()) {
      onAddSubtopic(topic.topic_id, newSubtopicText);
      setNewSubtopicText('');
      setShowAddSubtopic(false);
    }
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={0}
      sx={{
        mb: 1,
        border: '1px solid #e2e8f0',
        borderRadius: 1.5,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        '&:hover': {
          borderColor: '#667eea',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.1)',
        },
      }}
    >
      {/* Main Topic */}
      <Box
        sx={{
          py: 0.75,
          px: 1.5,
          background: '#fafbfc',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Tooltip title="Drag to reorder">
            <DragIndicator
              sx={{ color: '#94a3b8', cursor: 'grab', fontSize: 16 }}
              {...attributes}
              {...listeners}
            />
          </Tooltip>

          <Box
            sx={{
              width: 20,
              height: 20,
              minWidth: 20,
              borderRadius: 1,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.65rem',
            }}
          >
            {index + 1}
          </Box>

          {editingTopic?.id === topic.topic_id && !editingTopic.isSubtopic ? (
            <TextField
              fullWidth
              value={editingTopic.text}
              onChange={(e) => setEditingTopic({ ...editingTopic, text: e.target.value })}
              onKeyPress={(e) => e.key === 'Enter' && onSaveEdit()}
              onBlur={onSaveEdit}
              autoFocus
              variant="outlined"
              size="small"
              sx={{ '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5 } }}
            />
          ) : (
            <Typography
              sx={{
                flexGrow: 1,
                color: '#2d3748',
                fontWeight: 600,
                fontSize: '0.8rem',
              }}
            >
              {topic.topic}
            </Typography>
          )}

          {topic.added_from_benchmark && (
            <Tooltip title={topic.reconcile_note || (topic.benchmark_match ? `Added from benchmark: ${topic.benchmark_match}` : 'Added from the benchmark')}>
              <Chip
                label="added"
                size="small"
                sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, bgcolor: '#dcfce7', color: '#15803d' }}
              />
            </Tooltip>
          )}

          <Box display="flex" gap={0.25}>
            {topic.subtopics && topic.subtopics.length > 0 && (
              <Tooltip title={expandedTopics.has(topic.topic_id) ? 'Collapse' : 'Expand'}>
                <IconButton
                  size="small"
                  onClick={() => onToggleExpansion(topic.topic_id)}
                  sx={{ color: '#667eea', p: 0.25 }}
                >
                  {expandedTopics.has(topic.topic_id) ? <ExpandLess sx={{ fontSize: 16 }} /> : <ExpandMore sx={{ fontSize: 16 }} />}
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Edit topic">
              <IconButton
                size="small"
                onClick={() => onEditTopic(topic.topic_id, topic.topic, false)}
                sx={{ color: '#10b981', p: 0.25 }}
              >
                <Edit sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Add subtopic">
              <IconButton
                size="small"
                onClick={() => {
                  if (!expandedTopics.has(topic.topic_id)) {
                    onToggleExpansion(topic.topic_id);
                  }
                  setShowAddSubtopic(true);
                }}
                sx={{ color: '#667eea', p: 0.25 }}
              >
                <Add sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Delete topic">
              <IconButton
                size="small"
                onClick={() => onDeleteTopic(topic.topic_id, false)}
                sx={{ color: '#ef4444', p: 0.25 }}
              >
                <Delete sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Subtopics with Drag and Drop */}
      {expandedTopics.has(topic.topic_id) && topic.subtopics.length > 0 && (
        <Box sx={{ p: 1, pl: 2.5 }}>
          <DndContext
            sensors={subtopicSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleSubtopicDragEnd}
          >
            <SortableContext
              items={topic.subtopics.map(subtopic => subtopic.subtopic_id)}
              strategy={verticalListSortingStrategy}
            >
              {topic.subtopics.map((subtopic, subIndex) => (
                <SortableSubtopic
                  key={subtopic.subtopic_id}
                  subtopic={subtopic}
                  topicIndex={index}
                  subIndex={subIndex}
                  editingTopic={editingTopic}
                  onEditTopic={onEditTopic}
                  onDeleteTopic={onDeleteTopic}
                  onSaveEdit={onSaveEdit}
                  setEditingTopic={setEditingTopic}
                />
              ))}
            </SortableContext>
          </DndContext>
        </Box>
      )}

      {/* Add Subtopic Form */}
      {expandedTopics.has(topic.topic_id) && showAddSubtopic && (
        <Box sx={{ p: 1, pl: 2.5, borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <Box display="flex" gap={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              label="Subtopic Title"
              value={newSubtopicText}
              onChange={(e) => setNewSubtopicText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddSubtopic()}
              autoFocus
              variant="outlined"
            />
            <Button
              variant="contained"
              onClick={handleAddSubtopic}
              disabled={!newSubtopicText.trim()}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                minWidth: 'auto',
                px: 2,
                '&.Mui-disabled': {
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  opacity: 0.6,
                },
              }}
            >
              Add
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setShowAddSubtopic(false);
                setNewSubtopicText('');
              }}
              sx={{ minWidth: 'auto', px: 2 }}
            >
              Cancel
            </Button>
          </Box>
        </Box>
      )}
    </Paper>
  );
}

// ----- Self-contained editor: a draggable TOC + Add Section + Save, with its own edit state. -----

export interface TocEditorProps {
  toc: TOCTopic[];
  saving?: boolean;
  saveLabel?: string;
  onSave: (toc: TOCTopic[]) => void;
  maxHeight?: number | string;
}

const newId = () => `new_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const TocEditor: React.FC<TocEditorProps> = ({ toc, saving = false, saveLabel = 'Save', onSave, maxHeight = 340 }) => {
  // Compare only the titles/structure (ignore content) for re-seeding & the dirty flag.
  const sourceKey = useMemo(
    () => JSON.stringify((toc || []).map(t => ({ t: t.topic, s: (t.subtopics || []).map(x => x.topic) }))),
    [toc]
  );
  const [items, setItems] = useState<TOCTopic[]>(toc || []);
  const seededRef = useRef(sourceKey);
  useEffect(() => {
    if (seededRef.current !== sourceKey) {
      seededRef.current = sourceKey;
      setItems(toc || []);
    }
  }, [sourceKey, toc]);

  const [editingTopic, setEditingTopic] = useState<{ id: string; text: string; isSubtopic: boolean } | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const dirty = JSON.stringify(items.map(t => ({ t: t.topic, s: (t.subtopics || []).map(x => x.topic) }))) !== sourceKey;

  const toggleExpansion = (id: string) =>
    setExpandedTopics(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  const onEditTopic = (id: string, text: string, isSubtopic: boolean) => setEditingTopic({ id, text, isSubtopic });

  const onSaveEdit = () => {
    if (!editingTopic) return;
    setItems(prev => prev.map(t => {
      if (editingTopic.isSubtopic) {
        return { ...t, subtopics: t.subtopics.map(s => s.subtopic_id === editingTopic.id ? { ...s, topic: editingTopic.text } : s) };
      }
      return t.topic_id === editingTopic.id ? { ...t, topic: editingTopic.text } : t;
    }));
    setEditingTopic(null);
  };

  const onDeleteTopic = (id: string, isSubtopic: boolean) => {
    setItems(prev => isSubtopic
      ? prev.map(t => ({ ...t, subtopics: t.subtopics.filter(s => s.subtopic_id !== id) }))
      : prev.filter(t => t.topic_id !== id));
  };

  const onAddSubtopic = (topicId: string, text: string) => {
    if (!text.trim()) return;
    setItems(prev => prev.map(t => t.topic_id === topicId
      ? {
          ...t,
          subtopics: [...t.subtopics, {
            subtopic_id: newId(), topic: text.trim(), order: t.subtopics.length + 1,
            content: '', summary: '', conversation_history: [],
          }],
        }
      : t));
  };

  const addTopic = () => {
    const id = newId();
    setItems(prev => [...prev, {
      topic_id: id, topic: 'New Section', order: prev.length + 1,
      content: '', summary: '', conversation_history: [], subtopics: [],
    }]);
    setEditingTopic({ id, text: 'New Section', isSubtopic: false });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setItems(prev => {
        const oldIndex = prev.findIndex(i => i.topic_id === active.id);
        const newIndex = prev.findIndex(i => i.topic_id === over?.id);
        if (oldIndex < 0 || newIndex < 0) return prev;
        return arrayMove(prev, oldIndex, newIndex).map((t, i) => ({ ...t, order: i + 1 }));
      });
    }
  };

  const handleSubtopicDragEnd = (event: DragEndEvent, topicId: string) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setItems(prev => prev.map(t => {
        if (t.topic_id !== topicId) return t;
        const oldIndex = t.subtopics.findIndex(s => s.subtopic_id === active.id);
        const newIndex = t.subtopics.findIndex(s => s.subtopic_id === over?.id);
        if (oldIndex < 0 || newIndex < 0) return t;
        return { ...t, subtopics: arrayMove(t.subtopics, oldIndex, newIndex).map((s, i) => ({ ...s, order: i + 1 })) };
      }));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ overflow: 'auto', maxHeight, pr: 0.5 }}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map(t => t.topic_id)} strategy={verticalListSortingStrategy}>
            {items.map((topic, index) => (
              <SortableTopic
                key={topic.topic_id}
                topic={topic}
                index={index}
                editingTopic={editingTopic}
                expandedTopics={expandedTopics}
                onToggleExpansion={toggleExpansion}
                onEditTopic={onEditTopic}
                onDeleteTopic={onDeleteTopic}
                onSaveEdit={onSaveEdit}
                setEditingTopic={setEditingTopic}
                onAddSubtopic={onAddSubtopic}
                onSubtopicDragEnd={handleSubtopicDragEnd}
              />
            ))}
          </SortableContext>
        </DndContext>
      </Box>
      <Box display="flex" alignItems="center" gap={1} mt={1}>
        <Button
          size="small"
          startIcon={<Add sx={{ fontSize: 16 }} />}
          onClick={addTopic}
          sx={{ textTransform: 'none', color: '#667eea', fontWeight: 600 }}
        >
          Add Section
        </Button>
        <Box flex={1} />
        <Button
          size="small"
          variant="contained"
          startIcon={saving ? <CircularProgress size={13} color="inherit" /> : <Save sx={{ fontSize: 15 }} />}
          disabled={saving || !dirty}
          onClick={() => onSave(items)}
          sx={{
            background: dirty ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#cbd5e0',
            textTransform: 'none', fontWeight: 600, color: '#fff', px: 2,
          }}
        >
          {saveLabel}
        </Button>
      </Box>
    </Box>
  );
};

export default TocEditor;
