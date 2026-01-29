import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Button,
  Paper,
  IconButton,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Container,
  Snackbar,
  Fade,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Edit,
  Delete,
  Add,
  DragIndicator,
  ExpandMore,
  ExpandLess,
  Article,
  Business,
  LocationOn,
  CalendarToday,
  Person,
  CheckCircle,
  Close,
  Error,
  Visibility,
  Assessment,
  Description,
  PictureAsPdf,
  InsertDriveFile,
  EditNote,
  CloudDownload,
  Send,
  AutoAwesome,
  Source,
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
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { draftService } from '../services/draftService';
import { Draft, ConversationEntry, GenerateContentRequest, ContentGenerationResponse } from '../types/draft.types';

// Extended conversation entry to store full content
interface ExtendedConversationEntry extends ConversationEntry {
  full_content?: string;
  summary?: string;
  is_chat_response?: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`draft-tabpanel-${index}`}
      aria-labelledby={`draft-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>{children}</Box>}
    </div>
  );
}

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

function SortableSubtopic({
  subtopic,
  topicIndex,
  subIndex,
  editingTopic,
  onEditTopic,
  onDeleteTopic,
  onSaveEdit,
  setEditingTopic
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
        mb: 0.75,
        p: 1.5,
        px: 2,
        border: '1px solid #e2e8f0',
        borderRadius: 1,
        background: 'white',
        '&:hover': {
          borderColor: '#cbd5e0',
        },
      }}
    >
      <Box display="flex" alignItems="center" gap={1.5}>
        <Tooltip title="Drag to reorder subtopic">
          <DragIndicator
            sx={{ color: '#cbd5e0', cursor: 'grab', fontSize: 16 }}
            {...attributes}
            {...listeners}
          />
        </Tooltip>

        <Typography
          variant="body2"
          sx={{
            color: '#667eea',
            fontWeight: 600,
            minWidth: '40px',
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
          />
        ) : (
          <Typography
            variant="body1"
            sx={{
              flexGrow: 1,
              color: '#4a5568',
              fontWeight: 500,
            }}
          >
            {subtopic.topic}
          </Typography>
        )}

        <Box display="flex" gap={0.5}>
          <Tooltip title="Edit subtopic">
            <IconButton
              size="small"
              onClick={() => onEditTopic(subtopic.subtopic_id, subtopic.topic, true)}
              sx={{ color: '#10b981' }}
            >
              <Edit sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete subtopic">
            <IconButton
              size="small"
              onClick={() => onDeleteTopic(subtopic.subtopic_id, true)}
              sx={{ color: '#ef4444' }}
            >
              <Delete sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Paper>
  );
}

function SortableTopic({
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
  onSubtopicDragEnd
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
        distance: 8, // Require 8px movement before drag starts
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
        mb: 1.5,
        border: '1px solid #e2e8f0',
        borderRadius: 2,
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
          p: 1.5,
          px: 2,
          background: '#fafbfc',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Box display="flex" alignItems="center" gap={1.5}>
          <Tooltip title="Drag to reorder">
            <DragIndicator
              sx={{ color: '#94a3b8', cursor: 'grab', fontSize: 20 }}
              {...attributes}
              {...listeners}
            />
          </Tooltip>

          <Box
            sx={{
              width: 26,
              height: 26,
              minWidth: 26,
              borderRadius: 1.5,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.75rem',
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
            />
          ) : (
            <Typography
              variant="body1"
              sx={{
                flexGrow: 1,
                color: '#2d3748',
                fontWeight: 600,
              }}
            >
              {topic.topic}
            </Typography>
          )}

          <Box display="flex" gap={0.5}>
            {topic.subtopics && topic.subtopics.length > 0 && (
              <Tooltip title={expandedTopics.has(topic.topic_id) ? 'Collapse' : 'Expand'}>
                <IconButton
                  size="small"
                  onClick={() => onToggleExpansion(topic.topic_id)}
                  sx={{ color: '#667eea', p: 0.5 }}
                >
                  {expandedTopics.has(topic.topic_id) ? <ExpandLess sx={{ fontSize: 20 }} /> : <ExpandMore sx={{ fontSize: 20 }} />}
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Edit topic">
              <IconButton
                size="small"
                onClick={() => onEditTopic(topic.topic_id, topic.topic, false)}
                sx={{ color: '#10b981', p: 0.5 }}
              >
                <Edit sx={{ fontSize: 18 }} />
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
                sx={{ color: '#667eea', p: 0.5 }}
              >
                <Add sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>

            <Tooltip title="Delete topic">
              <IconButton
                size="small"
                onClick={() => onDeleteTopic(topic.topic_id, false)}
                sx={{ color: '#ef4444', p: 0.5 }}
              >
                <Delete sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* Subtopics with Drag and Drop */}
      {expandedTopics.has(topic.topic_id) && topic.subtopics.length > 0 && (
        <Box sx={{ p: 1.5, pl: 3 }}>
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
        <Box sx={{ p: 2, pl: 4, borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <Box display="flex" gap={2} alignItems="center">
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

interface ContentGenerationPanelProps {
  draft: Draft | null;
  currentToc: Draft['toc'];
  onContentUpdate?: (updatedToc: Draft['toc']) => void;
  editingTopic: { id: string; text: string; isSubtopic: boolean } | null;
  // Centralized state
  centralizedState: {
    selectedItem: {
      id: string;
      type: 'topic' | 'subtopic';
      title: string;
      content: string;
      conversation_history: ConversationEntry[];
      parentTopicId?: string;
    } | null;
    conversations: Record<string, ExtendedConversationEntry[]>;
    generatedContent: Record<string, string>;
    currentContent: Record<string, string>;
    hasUnsavedContent: Record<string, boolean>;
    lastSavedAt: Record<string, number>;
  };
  // State management functions
  updateSelectedItem: (item: {
    id: string;
    type: 'topic' | 'subtopic';
    title: string;
    content: string;
    conversation_history: ConversationEntry[];
    parentTopicId?: string;
  } | null) => void;
  updateConversationHistory: (itemId: string, history: ExtendedConversationEntry[]) => void;
  updateGeneratedContent: (itemId: string, content: string) => void;
  updateCurrentContent: (itemId: string, content: string) => void;
  markContentAsUnsaved: (itemId: string) => void;
  markContentAsSaved: (itemId: string) => void;
  // Auto-save functionality
  autoSaving: Record<string, boolean>;
  updateGeneratedContentWithAutoSave: (itemId: string, content: string) => void;
  // TOC Chat Mode
  tocChatMode: boolean;
  setTocChatMode: (mode: boolean) => void;
  tocPreview: Draft['toc'] | null;
  setTocPreview: (toc: Draft['toc'] | null) => void;
  pendingTocOperation: any;
  setPendingTocOperation: (op: any) => void;
  handleTocChatMessage: (chatInput: string, setChatInput: (input: string) => void, setGeneratingTopics: React.Dispatch<React.SetStateAction<Set<string>>>, setError: (error: string | null) => void) => Promise<void>;
  confirmTocModification: () => Promise<void>;
}

function ContentGenerationPanel({
  draft,
  currentToc,
  onContentUpdate,
  editingTopic,
  centralizedState,
  updateSelectedItem,
  updateConversationHistory,
  updateGeneratedContent,
  updateCurrentContent,
  markContentAsUnsaved,
  markContentAsSaved,
  autoSaving,
  updateGeneratedContentWithAutoSave,
  tocChatMode,
  setTocChatMode,
  tocPreview,
  setTocPreview,
  pendingTocOperation,
  setPendingTocOperation,
  handleTocChatMessage,
  confirmTocModification
}: ContentGenerationPanelProps) {
  // Extract state from centralized state
  const {
    selectedItem,
    conversations,
    generatedContent: allGeneratedContent,
    currentContent: allCurrentContent,
    hasUnsavedContent,
    lastSavedAt
  } = centralizedState;

  // Local UI state (not related to data persistence)
  const [chatInput, setChatInput] = useState('');
  const [generatingTopics, setGeneratingTopics] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showFullChatMessages, setShowFullChatMessages] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [isNavigating, setIsNavigating] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [rightPanelView, setRightPanelView] = useState<'generated' | 'current'>('generated');
  const conversationRef = React.useRef<HTMLDivElement>(null);

  // Derived values from centralized state
  const currentItemId = selectedItem?.id || '';
  const generatedContent = allGeneratedContent[currentItemId] || '';
  const currentContent = allCurrentContent[currentItemId] || '';
  const localConversationHistory = React.useMemo(() =>
    conversations[currentItemId] || [],
    [conversations, currentItemId]
  );
  const hasUnsavedContentFlag = hasUnsavedContent[currentItemId] || false;
  const isAutoSaving = autoSaving[currentItemId] || false;

  // No longer need useEffect for default selection - handled by parent

  // Auto-switch to Generated Content when editing topics so LLM responses are visible
  React.useEffect(() => {
    if (editingTopic && rightPanelView === 'current') {
      setRightPanelView('generated');
    }
  }, [editingTopic, rightPanelView]);

  const handleItemSelect = (item: {
    id: string;
    type: 'topic' | 'subtopic';
    title: string;
    content: string;
    conversation_history: ConversationEntry[];
    parentTopicId?: string;
  }) => {
    // Update selected item in centralized state
    updateSelectedItem(item);

    // Check if we already have conversation history in centralized state
    const existingHistory = conversations[item.id];

    // Only update conversation history if we don't have existing history
    // or if the existing history is empty
    if (!existingHistory || existingHistory.length === 0) {
      // Convert regular conversation entries to extended ones and update centralized state
      const extendedHistory: ExtendedConversationEntry[] = (item.conversation_history || []).map(entry => ({
        ...entry,
        full_content: entry.ai_response,
        summary: entry.ai_response?.length > 100 ? entry.ai_response.substring(0, 100) + '...' : entry.ai_response
      }));
      updateConversationHistory(item.id, extendedHistory);
    }

    // Always preserve existing generated content if it exists
    const existingGeneratedContent = allGeneratedContent[item.id];
    if (!existingGeneratedContent) {
      updateGeneratedContent(item.id, item.content || '');
    }

    // Don't automatically populate current content - it should only be set when user explicitly saves

    // Reset UI state
    setExpandedMessages(new Set());
    setError(null);
    // Don't clear generating state here - keep it per topic
  };

  // Function to create a summary of any message for chat display
  const createMessageSummary = (content: string): string => {
    if (!content) return '';

    // Create a concise one-liner (about 20 words / 100 characters)
    const words = content.trim().split(/\s+/);
    if (words.length <= 20) {
      return content.trim();
    }

    // Take first 20 words and add ellipsis
    const summary = words.slice(0, 20).join(' ');
    return summary + '...';
  };

  // Function to create a summary of generated content for chat display
  const createContentSummary = (content: string): string => {
    if (!content) return 'Generated content';
    return createMessageSummary(content);
  };

  // Function to handle clicking on a chat message
  const handleChatMessageClick = (entry: ExtendedConversationEntry, messageIndex: number) => {
    // Don't do anything for chat responses
    if (entry.is_chat_response) {
      return;
    }

    if (entry.full_content) {
      // Restore generated content to editor
      updateGeneratedContent(currentItemId, entry.full_content);
    } else if (entry.ai_response.split(/\s+/).length > 20) {
      // Toggle individual message expansion
      const messageId = `${entry.timestamp}_${messageIndex}`;
      setExpandedMessages(prev => {
        const newSet = new Set(prev);
        if (newSet.has(messageId)) {
          newSet.delete(messageId);
        } else {
          newSet.add(messageId);
        }
        return newSet;
      });
    }
  };

  // Function to find the next topic/subtopic to navigate to
  const findNextItem = () => {
    if (!selectedItem || !currentToc.length) return null;

    // Find current topic index
    const currentTopicIndex = currentToc.findIndex(topic => topic.topic_id === selectedItem.id);

    if (selectedItem.type === 'topic') {
      const currentTopic = currentToc[currentTopicIndex];

      // If current topic has subtopics, move to first subtopic
      if (currentTopic && currentTopic.subtopics.length > 0) {
        const firstSubtopic = currentTopic.subtopics[0];
        return {
          id: firstSubtopic.subtopic_id,
          type: 'subtopic' as const,
          title: firstSubtopic.topic,
          content: firstSubtopic.content || '',
          conversation_history: firstSubtopic.conversation_history || [],
          parentTopicId: currentTopic.topic_id
        };
      }

      // If no subtopics, move to next topic
      if (currentTopicIndex < currentToc.length - 1) {
        const nextTopic = currentToc[currentTopicIndex + 1];
        return {
          id: nextTopic.topic_id,
          type: 'topic' as const,
          title: nextTopic.topic,
          content: nextTopic.content || '',
          conversation_history: nextTopic.conversation_history || []
        };
      }
    } else if (selectedItem.type === 'subtopic') {
      // Find parent topic
      const parentTopic = currentToc.find(topic =>
        topic.subtopics.some(sub => sub.subtopic_id === selectedItem.id)
      );

      if (parentTopic) {
        const currentSubtopicIndex = parentTopic.subtopics.findIndex(sub => sub.subtopic_id === selectedItem.id);

        // If there's a next subtopic in the same topic
        if (currentSubtopicIndex < parentTopic.subtopics.length - 1) {
          const nextSubtopic = parentTopic.subtopics[currentSubtopicIndex + 1];
          return {
            id: nextSubtopic.subtopic_id,
            type: 'subtopic' as const,
            title: nextSubtopic.topic,
            content: nextSubtopic.content || '',
            conversation_history: nextSubtopic.conversation_history || [],
            parentTopicId: parentTopic.topic_id
          };
        }

        // If this was the last subtopic, move to next topic
        const parentTopicIndex = currentToc.findIndex(topic => topic.topic_id === parentTopic.topic_id);
        if (parentTopicIndex < currentToc.length - 1) {
          const nextTopic = currentToc[parentTopicIndex + 1];
          return {
            id: nextTopic.topic_id,
            type: 'topic' as const,
            title: nextTopic.topic,
            content: nextTopic.content || '',
            conversation_history: nextTopic.conversation_history || []
          };
        }
      }
    }

    return null; // No next item (reached the end)
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedItem || !draft) return;

    const userMessage = chatInput.trim();
    // Capture the item ID at generation start to prevent race conditions
    const generationItemId = selectedItem.id;
    setChatInput('');
    setGeneratingTopics(prev => {
      const newSet = new Set(prev);
      newSet.add(generationItemId);
      return newSet;
    });
    setError(null);

    // Add user message to local history immediately for UI feedback
    const newUserEntry: ExtendedConversationEntry = {
      timestamp: new Date().toISOString(),
      user_message: userMessage,
      ai_response: '', // Will be filled when we get the response
      full_content: '',
      summary: ''
    };

    // Add user message immediately and scroll to show it
    const updatedHistory = [...localConversationHistory, newUserEntry];
    updateConversationHistory(generationItemId, updatedHistory);
    setTimeout(scrollToBottom, 100); // Scroll to show user message immediately

    try {
      const requestData: GenerateContentRequest = {
        user_prompt: userMessage,
        subtopic_id: selectedItem.type === 'subtopic' ? selectedItem.id : undefined
      };

      // Determine the topic ID to use for the API call
      const topicIdForApi = selectedItem.type === 'topic'
        ? selectedItem.id
        : selectedItem.parentTopicId || selectedItem.id;

      const response: ContentGenerationResponse = await draftService.generateContent(
        draft.id,
        topicIdForApi,
        requestData
      );

      // Use the actual generated content as the AI message
      const fullContent = response.content;
      const contentSummary = createContentSummary(fullContent);
      // Display the actual generated content in the chat
      const aiMessage = fullContent;

      // Update the conversation entry with AI response and content
      const completeEntry: ExtendedConversationEntry = {
        ...newUserEntry,
        ai_response: aiMessage,
        full_content: fullContent,
        summary: contentSummary,
        is_chat_response: response.is_chat_response
      };

      // Update conversation history in centralized state
      const finalUpdatedHistory = [...localConversationHistory, completeEntry];
      updateConversationHistory(generationItemId, finalUpdatedHistory);

      // Only update generated content if it's not a chat response
      if (!response.is_chat_response) {
        // Update generated content in centralized state
        updateGeneratedContent(generationItemId, fullContent);

        // Mark content as unsaved to trigger save UI
        markContentAsUnsaved(generationItemId);

        // Switch to Generated Content tab when new content is generated
        if (generationItemId === currentItemId) {
          setRightPanelView('generated');
        }
      }

    } catch (error: any) {
      console.error('Content generation failed:', error);

      // Add error message to conversation
      const errorEntry: ExtendedConversationEntry = {
        ...newUserEntry,
        ai_response: `Sorry, I encountered an error: ${error.response?.data?.detail || error.message || 'Unknown error'}`,
        full_content: '',
        summary: ''
      };

      const errorUpdatedHistory = [...localConversationHistory, errorEntry];
      updateConversationHistory(generationItemId, errorUpdatedHistory);

      setError(error.response?.data?.detail || error.message || 'Failed to generate content. Please try again.');
    } finally {
      setGeneratingTopics(prev => {
        const newSet = new Set(prev);
        newSet.delete(generationItemId);
        return newSet;
      });
    }
  };

  const handleSaveContent = async () => {
    if (!selectedItem || !draft || !generatedContent.trim()) return;

    try {
      setError(null);
      const topicIdForApi = selectedItem.type === 'topic'
        ? selectedItem.id
        : selectedItem.parentTopicId || selectedItem.id;

      await draftService.updateContent(
        draft.id,
        topicIdForApi,
        generatedContent,
        selectedItem.type === 'subtopic' ? selectedItem.id : undefined,
        localConversationHistory
      );

      // Update currentToc immediately with the saved content and conversation history
      if (onContentUpdate) {
        const updatedToc = currentToc.map(topic => {
          if (selectedItem.type === 'topic' && topic.topic_id === selectedItem.id) {
            // Update main topic content and conversation history
            return {
              ...topic,
              content: generatedContent,
              conversation_history: localConversationHistory
            };
          } else if (selectedItem.type === 'subtopic') {
            // Update subtopic content and conversation history
            const updatedSubtopics = topic.subtopics.map(subtopic => {
              if (subtopic.subtopic_id === selectedItem.id) {
                return {
                  ...subtopic,
                  content: generatedContent,
                  conversation_history: localConversationHistory
                };
              }
              return subtopic;
            });
            return { ...topic, subtopics: updatedSubtopics };
          }
          return topic;
        });
        onContentUpdate(updatedToc);
      }

      // Update centralized state to mark as saved and update current content
      markContentAsSaved(currentItemId);
      updateCurrentContent(currentItemId, generatedContent);

      // Show success message
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000); // Hide after 3 seconds

      // Find next item to navigate to
      const nextItem = findNextItem();

      if (nextItem) {
        // Show navigation feedback
        setIsNavigating(true);

        // Auto-navigate to next topic/subtopic after a brief delay
        setTimeout(() => {
          handleItemSelect(nextItem);
          setIsNavigating(false);
        }, 1500); // 1.5 second delay to show success message first
      }

      // Update currentToc to reflect the new content
      if (onContentUpdate) {
        const updatedToc = currentToc.map(topic => {
          if (selectedItem.type === 'topic' && topic.topic_id === selectedItem.id) {
            // Update main topic content
            return { ...topic, content: generatedContent };
          } else if (selectedItem.type === 'subtopic') {
            // Update subtopic content
            const updatedSubtopics = topic.subtopics.map(subtopic => {
              if (subtopic.subtopic_id === selectedItem.id) {
                return { ...subtopic, content: generatedContent };
              }
              return subtopic;
            });
            return { ...topic, subtopics: updatedSubtopics };
          }
          return topic;
        });
        onContentUpdate(updatedToc);
      }

      console.log('Content saved successfully');
    } catch (error: any) {
      console.error('Failed to save content:', error);
      setError(error.response?.data?.detail || error.message || 'Failed to save content');
      setSaveSuccess(false);
    }
  };

  // Handle saving edited content
  const handleSaveEditedContent = async () => {
    if (!selectedItem || !draft || !editedContent.trim()) return;

    try {
      setError(null);
      const topicIdForApi = selectedItem.type === 'topic'
        ? selectedItem.id
        : selectedItem.parentTopicId;
      const subtopicIdForApi = selectedItem.type === 'subtopic'
        ? selectedItem.id
        : undefined;

      if (!topicIdForApi) return;

      await draftService.updateContent(
        draft.id,
        topicIdForApi,
        editedContent,
        subtopicIdForApi,
        localConversationHistory
      );

      // Update the selectedItem with new content in centralized state
      if (selectedItem) {
        updateSelectedItem({ ...selectedItem, content: editedContent });
      }

      // Update currentToc to reflect the new content and conversation history
      if (onContentUpdate) {
        const updatedToc = currentToc.map(topic => {
          if (selectedItem.type === 'topic' && topic.topic_id === selectedItem.id) {
            // Update main topic content and conversation history
            return {
              ...topic,
              content: editedContent,
              conversation_history: localConversationHistory
            };
          } else if (selectedItem.type === 'subtopic') {
            // Update subtopic content and conversation history
            const updatedSubtopics = topic.subtopics.map(subtopic => {
              if (subtopic.subtopic_id === selectedItem.id) {
                return {
                  ...subtopic,
                  content: editedContent,
                  conversation_history: localConversationHistory
                };
              }
              return subtopic;
            });
            return { ...topic, subtopics: updatedSubtopics };
          }
          return topic;
        });
        onContentUpdate(updatedToc);
      }

      // Update centralized state
      markContentAsSaved(currentItemId);
      updateCurrentContent(currentItemId, editedContent);
      updateGeneratedContent(currentItemId, editedContent);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      console.log('Content updated successfully');
    } catch (error: any) {
      console.error('Failed to update content:', error);
      setError(error.response?.data?.detail || error.message || 'Failed to update content');
    }
  };

  // Sync editedContent when selectedItem changes
  React.useEffect(() => {
    if (selectedItem) {
      setEditedContent(selectedItem.content || '');
    }
  }, [selectedItem]);

  // Auto-scroll to bottom function
  const scrollToBottom = React.useCallback(() => {
    if (conversationRef.current) {
      const scrollElement = conversationRef.current;
      scrollElement.scrollTop = scrollElement.scrollHeight;
    }
  }, []);

  // Auto-scroll when conversation history changes (new messages)
  React.useEffect(() => {
    if (localConversationHistory.length > 0) {
      // Small delay to ensure DOM has updated
      setTimeout(scrollToBottom, 100);
    }
  }, [localConversationHistory, scrollToBottom]);

  // Auto-scroll when generating content (streaming effect)
  React.useEffect(() => {
    const isCurrentTopicGenerating = generatingTopics.has(currentItemId);
    if (isCurrentTopicGenerating) {
      // Scroll during generation to show progress
      const scrollInterval = setInterval(scrollToBottom, 500);
      return () => clearInterval(scrollInterval);
    }
  }, [generatingTopics, currentItemId, scrollToBottom]);

  // Auto-scroll when generated content updates (AI responses)
  React.useEffect(() => {
    const isCurrentTopicGenerating = generatingTopics.has(currentItemId);
    if (generatedContent && isCurrentTopicGenerating) {
      // Scroll when new content is being generated
      setTimeout(scrollToBottom, 100);
    }
  }, [generatedContent, generatingTopics, currentItemId, scrollToBottom]);

  return (
    <Box sx={{ height: { xs: 'auto', lg: 'calc(100vh - 300px)' }, display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2 }}>
      {/* Left Sidebar - Topic Selection */}
      <Paper
        elevation={0}
        sx={{
          width: { xs: '100%', lg: 220 },
          minWidth: { lg: 220 },
          flexShrink: 0,
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: { xs: 300, lg: 'none' },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 1.5,
            px: 2,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
          }}
        >
          <Typography variant="body1" fontWeight={600}>
            Content Topics
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.9 }}>
            Select a section to generate
          </Typography>
        </Box>

        {/* Topic List */}
        <Box sx={{
          flex: 1,
          overflow: 'auto',
          p: 1,
          // Custom scrollbar styling
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255, 255, 255, 0.3)',
            borderRadius: '10px',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.5)',
            },
          },
          // Firefox scrollbar
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1)',
        }}>
          {currentToc.map((topic, topicIndex) => (
            <Box key={topic.topic_id} sx={{ mb: 1 }}>
              {/* Main Topic */}
              <Paper
                elevation={0}
                onClick={() => {
                  // Use conversation history from centralized state if available
                  const centralizedHistory = conversations[topic.topic_id];
                  const conversationHistory = centralizedHistory && centralizedHistory.length > 0
                    ? centralizedHistory.map(entry => ({
                        user_message: entry.user_message,
                        ai_response: entry.ai_response || entry.full_content || '',
                        timestamp: entry.timestamp
                      }))
                    : topic.conversation_history || [];

                  handleItemSelect({
                    id: topic.topic_id,
                    type: 'topic',
                    title: topic.topic,
                    content: topic.content || '',
                    conversation_history: conversationHistory
                  });
                }}
                sx={{
                  p: 1,
                  px: 1.5,
                  cursor: 'pointer',
                  border: topic.content ? '2px solid #10b981' : '1px solid #e2e8f0',
                  borderRadius: 1.5,
                  mb: 0.5,
                  background: selectedItem?.id === topic.topic_id
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
                    : topic.content
                      ? '#f0f9f4'
                      : 'white',
                  borderColor: selectedItem?.id === topic.topic_id
                    ? '#667eea'
                    : topic.content
                      ? '#10b981'
                      : '#e2e8f0',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    borderColor: topic.content ? '#059669' : '#667eea',
                    transform: 'translateY(-1px)',
                    boxShadow: topic.content
                      ? '0 4px 12px rgba(16, 185, 129, 0.25)'
                      : '0 4px 12px rgba(102, 126, 234, 0.15)',
                  },
                }}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  <Box flex={1} minWidth={0}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        color: selectedItem?.id === topic.topic_id
                          ? '#667eea'
                          : topic.content
                            ? '#059669'
                            : '#2d3748',
                        fontSize: '0.8rem',
                        lineHeight: 1.3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {topic.topic}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        color: topic.content ? '#10b981' : '#718096',
                        fontWeight: topic.content ? 600 : 400,
                        fontSize: '0.65rem',
                      }}
                    >
                      {topic.content ? '✓ Done' : 'No content'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>

              {/* Subtopics */}
              {topic.subtopics.map((subtopic, subIndex) => (
                <Paper
                  key={subtopic.subtopic_id}
                  elevation={0}
                  onClick={() => {
                    // Use conversation history from centralized state if available
                    const centralizedHistory = conversations[subtopic.subtopic_id];
                    const conversationHistory = centralizedHistory && centralizedHistory.length > 0
                      ? centralizedHistory.map(entry => ({
                          user_message: entry.user_message,
                          ai_response: entry.ai_response || entry.full_content || '',
                          timestamp: entry.timestamp
                        }))
                      : subtopic.conversation_history || [];

                    handleItemSelect({
                      id: subtopic.subtopic_id,
                      type: 'subtopic',
                      title: subtopic.topic,
                      content: subtopic.content || '',
                      conversation_history: conversationHistory,
                      parentTopicId: topic.topic_id
                    });
                  }}
                  sx={{
                    p: 0.75,
                    px: 1.5,
                    ml: 2,
                    cursor: 'pointer',
                    border: subtopic.content ? '2px solid #10b981' : '1px solid #e2e8f0',
                    borderRadius: 1.5,
                    mb: 0.5,
                    background: selectedItem?.id === subtopic.subtopic_id
                      ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)'
                      : subtopic.content
                        ? '#f0f9f4'
                        : 'white',
                    borderColor: selectedItem?.id === subtopic.subtopic_id
                      ? '#667eea'
                      : subtopic.content
                        ? '#10b981'
                        : '#e2e8f0',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: subtopic.content ? '#059669' : '#667eea',
                      transform: 'translateY(-1px)',
                      boxShadow: subtopic.content
                        ? '0 4px 12px rgba(16, 185, 129, 0.25)'
                        : '0 4px 12px rgba(102, 126, 234, 0.15)',
                    },
                  }}
                >
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: selectedItem?.id === subtopic.subtopic_id
                          ? '#667eea'
                          : subtopic.content
                            ? '#10b981'
                            : '#718096',
                        fontWeight: 600,
                        fontSize: '0.65rem',
                        minWidth: '28px',
                      }}
                    >
                      {topicIndex + 1}.{subIndex + 1}
                    </Typography>
                    <Box flex={1} minWidth={0}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          color: selectedItem?.id === subtopic.subtopic_id
                            ? '#667eea'
                            : subtopic.content
                              ? '#059669'
                              : '#4a5568',
                          fontSize: '0.75rem',
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {subtopic.topic}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          ))}
        </Box>
      </Paper>

      {/* Center Panel - Chat Interface */}
      <Paper
        elevation={0}
        sx={{
          flex: '1 1 auto',
          minWidth: 0,
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: { xs: 400, lg: 'auto' },
        }}
      >
        {/* Header */}
        {selectedItem && (
          <Box
            sx={{
              py: 1,
              px: 2,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box flex={1} minWidth={0}>
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedItem.title}
                </Typography>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.9)', fontSize: '0.65rem' }}>
                  {selectedItem.type === 'topic' ? 'Main Topic' : 'Subtopic'} • Content Generation
                </Typography>
              </Box>

              {/* Chat Display Toggle */}
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                  Chat:
                </Typography>
                <Button
                  size="small"
                  onClick={() => setShowFullChatMessages(!showFullChatMessages)}
                  sx={{
                    minWidth: 80,
                    height: 28,
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: 2,
                    color: showFullChatMessages ? 'white' : 'rgba(255, 255, 255, 0.9)',
                    background: showFullChatMessages ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                    '&:hover': {
                      borderColor: 'rgba(255, 255, 255, 0.5)',
                      background: showFullChatMessages ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.15)',
                      color: 'white',
                    },
                  }}
                >
                  {showFullChatMessages ? '📄 Full' : '📝 Summary'}
                </Button>
              </Box>
            </Box>
          </Box>
        )}


        {/* Conversation History */}
        <Box
          ref={conversationRef}
          sx={{
            flex: 1,
            overflow: 'auto',
            p: 3,
            minHeight: 200,
            // Custom scrollbar styling
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(0, 0, 0, 0.05)',
              borderRadius: '10px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.6) 0%, rgba(118, 75, 162, 0.6) 100%)',
              borderRadius: '10px',
              '&:hover': {
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.8) 100%)',
              },
            },
            // Firefox scrollbar
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(102, 126, 234, 0.6) rgba(0, 0, 0, 0.05)',
          }}
        >
          {localConversationHistory.length === 0 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                pt: 1,
                color: '#718096',
              }}
            >
              {/* <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 1,
                }}
              >
                <Typography variant="body1" sx={{ color: 'white' }}>✨</Typography>
              </Box> */}
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: '#2d3748' }}>
                Start Content Generation
              </Typography>
              <Typography variant="caption" sx={{ textAlign: 'center', maxWidth: 300 }}>
                Ask questions or request content for "{selectedItem?.title}".
              </Typography>
            </Box>
          )}

          {/* Chat Messages */}
          {localConversationHistory.map((message, index) => (
            <Box key={index} sx={{ mb: 3 }}>
              {/* User Message */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                <Paper
                  elevation={0}
                  sx={{
                    maxWidth: '70%',
                    p: 2,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    borderRadius: '18px 18px 6px 18px',
                  }}
                >
                  <Typography variant="body2">{message.user_message}</Typography>
                </Paper>
              </Box>

              {/* AI Response */}
              {message.ai_response && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <Paper
                    elevation={0}
                    onClick={() => handleChatMessageClick(message, index)}
                    sx={{
                      maxWidth: '70%',
                      p: 2,
                      background: message.is_chat_response ? '#fef2f2' :
                                message.full_content ? '#f0f9f4' :
                                (!showFullChatMessages && message.ai_response.split(/\s+/).length > 20) ? '#f0f4ff' : '#f7fafc',
                      border: message.is_chat_response ? '1px solid #f87171' :
                              message.full_content ? '1px solid #10b981' :
                              (!showFullChatMessages && message.ai_response.split(/\s+/).length > 20) ? '1px solid #667eea' : '1px solid #e2e8f0',
                      borderRadius: '18px 18px 18px 6px',
                      cursor: message.is_chat_response ? 'default' : (message.full_content || (!showFullChatMessages && message.ai_response.split(/\s+/).length > 20)) ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      '&:hover': message.is_chat_response ? {} : (message.full_content || (!showFullChatMessages && message.ai_response.split(/\s+/).length > 20)) ? {
                        background: message.full_content ? '#ecfdf5' : '#e6f0ff',
                        borderColor: message.full_content ? '#059669' : '#5569d8',
                        transform: 'translateY(-1px)',
                        boxShadow: message.full_content ? '0 4px 12px rgba(16, 185, 129, 0.15)' : '0 4px 12px rgba(102, 126, 234, 0.15)',
                      } : {},
                    }}
                  >
                    <Typography variant="body2" sx={{ color: '#2d3748', whiteSpace: 'pre-wrap' }}>
                      {(() => {
                        const messageId = `${message.timestamp}_${index}`;
                        const isIndividuallyExpanded = expandedMessages.has(messageId);
                        const shouldShowFull = showFullChatMessages || isIndividuallyExpanded;

                        if (shouldShowFull) {
                          return message.ai_response;
                        } else {
                          return message.full_content
                            ? `Generated content: ${message.summary || createContentSummary(message.full_content)}`
                            : createMessageSummary(message.ai_response);
                        }
                      })()}
                    </Typography>
                    {(() => {
                      const messageId = `${message.timestamp}_${index}`;
                      const isIndividuallyExpanded = expandedMessages.has(messageId);
                      const isLongMessage = message.ai_response && message.ai_response.split(/\s+/).length > 20;
                      const shouldShowIndicator = !showFullChatMessages && isLongMessage;

                      if (!shouldShowIndicator) return null;

                      return (
                        <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${message.full_content ? 'rgba(16, 185, 129, 0.2)' : 'rgba(102, 126, 234, 0.2)'}` }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: message.full_content ? '#10b981' : '#667eea',
                              fontWeight: 500,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            {message.full_content
                              ? '📝 Click to view full content'
                              : isIndividuallyExpanded
                                ? '🔼 Click to collapse message'
                                : '💬 Click to expand message'
                            }
                          </Typography>
                        </Box>
                      );
                    })()}
                  </Paper>
                </Box>
              )}
            </Box>
          ))}

          {generatingTopics.has(currentItemId) && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  background: '#f7fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '18px 18px 18px 6px',
                }}
              >
                <Box display="flex" alignItems="center" gap={1}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" sx={{ color: '#718096' }}>
                    Generating content...
                  </Typography>
                </Box>
              </Paper>
            </Box>
          )}
        </Box>

        {/* Input Area */}
        <Box
          sx={{
            p: 1,
            px: 1.5,
            borderTop: '1px solid #e2e8f0',
            background: '#fafbfc',
          }}
        >
          <Box display="flex" gap={1} alignItems="center">
            <TextField
              fullWidth
              placeholder="Ask me to generate content..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              multiline
              maxRows={2}
              size="small"
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  background: 'white',
                  fontSize: '0.85rem',
                  '&.Mui-focused fieldset': {
                    borderColor: '#667eea',
                  },
                },
              }}
            />
            <Button
              variant="contained"
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || generatingTopics.has(currentItemId)}
              sx={{
                minWidth: 40,
                height: 40,
                borderRadius: 2,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5569d8 0%, #6a4291 100%)',
                },
              }}
            >
              🚀
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Right Panel - Content Preview */}
      <Paper
        elevation={0}
        sx={{
          width: { xs: '100%', lg: 300 },
          minWidth: { lg: 300 },
          flexShrink: 0,
          border: '1px solid #e2e8f0',
          borderRadius: 3,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: { xs: 300, lg: 'auto' },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            py: 0.5,
            px: 1.5,
            background: 'linear-gradient(135deg, #10b981 0%, #065f46 100%)',
            color: 'white',
          }}
        >
          <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem' }}>
            {rightPanelView === 'generated' ? 'Generated Content' : 'Current Content'} — Preview and edit
          </Typography>
        </Box>

        {/* Toggle Buttons */}
        <Box sx={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => setRightPanelView('generated')}
            sx={{
              flex: 1,
              py: 0.5,
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 0,
              borderBottom: rightPanelView === 'generated' ? '2px solid #10b981' : '2px solid transparent',
              color: rightPanelView === 'generated' ? '#10b981' : '#718096',
              background: rightPanelView === 'generated' ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
              minHeight: 0,
              '&:hover': {
                background: rightPanelView === 'generated'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'rgba(16, 185, 129, 0.05)',
              },
            }}
          >
            Generated
          </Button>
          <Button
            onClick={() => setRightPanelView('current')}
            disabled={!currentContent}
            sx={{
              flex: 1,
              py: 0.5,
              fontSize: '0.75rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 0,
              borderBottom: rightPanelView === 'current' ? '2px solid #10b981' : '2px solid transparent',
              color: rightPanelView === 'current' ? '#10b981' : '#718096',
              background: rightPanelView === 'current' ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
              minHeight: 0,
              '&:hover': {
                background: rightPanelView === 'current'
                  ? 'rgba(16, 185, 129, 0.1)'
                  : 'rgba(16, 185, 129, 0.05)',
              },
              '&:disabled': {
                color: 'rgba(113, 128, 150, 0.5)',
                background: 'transparent',
                borderBottom: '2px solid transparent',
              },
            }}
          >
            Current
          </Button>
        </Box>

        {/* Content Area */}
        <Box sx={{
          flex: 1,
          p: 1,
          overflow: 'auto',
          // Custom scrollbar styling - green theme
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(0, 0, 0, 0.05)',
            borderRadius: '10px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.6) 0%, rgba(6, 95, 70, 0.6) 100%)',
            borderRadius: '10px',
            '&:hover': {
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.8) 0%, rgba(6, 95, 70, 0.8) 100%)',
            },
          },
          // Firefox scrollbar
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(16, 185, 129, 0.6) rgba(0, 0, 0, 0.05)',
        }}>
          {rightPanelView === 'generated' ? (
            // Generated Content View
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: '#718096', mb: 0.5, fontSize: '0.65rem' }}>
                Editable • {generatedContent && typeof generatedContent === 'string' ? generatedContent.split(/\s+/).filter(word => word.length > 0).length : 0} words
              </Typography>
              <TextField
                fullWidth
                multiline
                value={generatedContent}
                onChange={(e) => updateGeneratedContentWithAutoSave(currentItemId, e.target.value)}
                placeholder="Generated content will appear here..."
                variant="outlined"
                size="small"
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    height: '100%',
                    borderRadius: 1,
                    fontSize: '0.8rem',
                    lineHeight: 1.5,
                    alignItems: 'flex-start',
                    background: 'white',
                    '&.Mui-focused fieldset': {
                      borderColor: '#10b981',
                    },
                  },
                  '& .MuiInputBase-input': {
                    fontFamily: 'inherit',
                    padding: '8px !important',
                  },
                }}
              />
            </Box>
          ) : (
            // Current Content View
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="caption" sx={{ color: '#718096', mb: 0.5, fontSize: '0.65rem' }}>
                {selectedItem?.content && typeof selectedItem.content === 'string'
                  ? `Saved • ${selectedItem.content.split(/\s+/).filter(word => word.length > 0).length} words`
                  : 'No saved content yet'
                }
              </Typography>
              <TextField
                fullWidth
                multiline
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                placeholder={selectedItem?.content
                  ? "Your saved content..."
                  : "Enter your content here..."
                }
                variant="outlined"
                size="small"
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    height: '100%',
                    borderRadius: 1,
                    fontSize: '0.8rem',
                    lineHeight: 1.5,
                    alignItems: 'flex-start',
                    background: 'white',
                    '&.Mui-focused fieldset': {
                      borderColor: '#10b981',
                    },
                  },
                  '& .MuiInputBase-input': {
                    fontFamily: 'inherit',
                    padding: '8px !important',
                  },
                }}
              />
            </Box>
          )}
        </Box>

        {/* Actions */}
        <Box
          sx={{
            px: 1,
            py: 0.75,
            borderTop: '1px solid #e2e8f0',
            background: '#fafbfc',
          }}
        >
          {error && (
            <Alert severity="error" sx={{ mb: 0.5, py: 0, '& .MuiAlert-message': { fontSize: '0.7rem' } }}>
              {error}
            </Alert>
          )}
          {saveSuccess && (
            <Alert severity="success" sx={{ mb: 0.5, py: 0, '& .MuiAlert-message': { fontSize: '0.7rem' } }}>
              {(() => {
                const nextItem = findNextItem();
                if (isNavigating && nextItem) {
                  return `Saved! Moving to "${nextItem.title}"...`;
                } else if (!nextItem) {
                  return `Saved! All sections done!`;
                } else {
                  return `Saved!`;
                }
              })()}
            </Alert>
          )}

          {/* Save Status Indicators */}
          <Box sx={{
            mb: 0.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 0.5,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {isAutoSaving && (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: '#10b981',
                  fontSize: '0.65rem',
                  fontWeight: 500
                }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      border: '2px solid #10b981',
                      borderTop: '2px solid transparent',
                      animation: 'spin 1s linear infinite',
                      '@keyframes spin': {
                        '0%': { transform: 'rotate(0deg)' },
                        '100%': { transform: 'rotate(360deg)' }
                      }
                    }}
                  />
                  Saving...
                </Box>
              )}
              {!isAutoSaving && hasUnsavedContentFlag && (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: '#f59e0b',
                  fontSize: '0.65rem',
                  fontWeight: 500
                }}>
                  <Box sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b'
                  }} />
                  Unsaved
                </Box>
              )}
              {!isAutoSaving && !hasUnsavedContentFlag && lastSavedAt[currentItemId] && (
                <Box sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: '#059669',
                  fontSize: '0.65rem',
                  fontWeight: 500
                }}>
                  <Box sx={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: '#059669'
                  }} />
                  Saved
                </Box>
              )}
            </Box>

            {lastSavedAt[currentItemId] && (
              <Box sx={{
                fontSize: '0.6rem',
                color: '#64748b',
              }}>
                {new Date(lastSavedAt[currentItemId]).toLocaleTimeString()}
              </Box>
            )}
          </Box>

          {rightPanelView === 'generated' ? (
            <Button
              fullWidth
              size="small"
              variant="contained"
              disabled={!generatedContent.trim() || (!hasUnsavedContent[currentItemId] && generatedContent === (selectedItem?.content || ''))}
              onClick={handleSaveContent}
              sx={{
                fontSize: '0.75rem',
                py: 0.5,
                textTransform: 'none',
                background: saveSuccess
                  ? 'linear-gradient(135deg, #059669 0%, #064e3b 100%)'
                  : 'linear-gradient(135deg, #10b981 0%, #065f46 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
                },
                '&:disabled': {
                  background: '#e2e8f0',
                  color: '#94a3b8',
                },
              }}
            >
              {saveSuccess ? 'Saved ✓' : 'Save Content'}
            </Button>
          ) : (
            <Button
              fullWidth
              size="small"
              variant="contained"
              onClick={handleSaveEditedContent}
              disabled={!editedContent.trim() || editedContent === (selectedItem?.content || '')}
              sx={{
                fontSize: '0.75rem',
                py: 0.5,
                textTransform: 'none',
                background: 'linear-gradient(135deg, #10b981 0%, #065f46 100%)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
                },
                '&:disabled': {
                  background: '#e2e8f0',
                  color: '#94a3b8',
                },
              }}
            >
              {!selectedItem?.content ? 'No Content' : 'Save Changes'}
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

interface ExportReviewPanelProps {
  draft: Draft | null;
  currentToc: Draft['toc'];
}

function ExportReviewPanel({ draft, currentToc }: ExportReviewPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [selectedExportFormat, setSelectedExportFormat] = useState<'word' | 'pdf'>('word');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [previewMode, setPreviewMode] = useState<'overview' | 'content'>('overview');
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Calculate document statistics
  const documentStats = React.useMemo(() => {
    if (!currentToc.length) return { totalSections: 0, completedSections: 0, totalWords: 0, totalCharacters: 0 };

    let totalSections = currentToc.length;
    let completedSections = 0;
    let totalWords = 0;
    let totalCharacters = 0;

    currentToc.forEach(topic => {
      if (topic.content && topic.content.trim()) {
        completedSections++;
        totalWords += topic.content.split(/\s+/).length;
        totalCharacters += topic.content.length;
      }

      totalSections += topic.subtopics.length;
      topic.subtopics.forEach(subtopic => {
        if (subtopic.content && subtopic.content.trim()) {
          completedSections++;
          totalWords += subtopic.content.split(/\s+/).length;
          totalCharacters += subtopic.content.length;
        }
      });
    });

    return { totalSections, completedSections, totalWords, totalCharacters };
  }, [currentToc]);

  const completionPercentage = documentStats.totalSections > 0
    ? Math.round((documentStats.completedSections / documentStats.totalSections) * 100)
    : 0;

  const handleExport = async () => {
    if (!draft) return;

    setIsExporting(true);
    try {
      let blob: Blob;
      let filename: string;

      if (selectedExportFormat === 'word') {
        blob = await draftService.exportToWord(draft.id);
        filename = `${draft.metadata.title}.docx`;
      } else {
        // selectedExportFormat === 'pdf'
        blob = await draftService.exportToPDF(draft.id);
        filename = `${draft.metadata.title}.pdf`;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!draft) return null;

  return (
    <Box sx={{ maxWidth: '1400px', mx: 'auto' }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ color: '#1a202c', fontWeight: 700, mb: 2 }}>
          Export & Review
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748b', mb: 3 }}>
          Review your complete policy document and export it in your preferred format.
        </Typography>
      </Box>

      {/* Progress Overview Dashboard */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr 1fr' }, gap: 3, mb: 4 }}>
        {/* Completion Status */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 2 }}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Assessment sx={{ fontSize: 32 }} />
              <Typography variant="h6" fontWeight={600}>
                Completion
              </Typography>
            </Box>
            <Typography variant="h3" fontWeight={700} sx={{ mb: 1 }}>
              {completionPercentage}%
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              {documentStats.completedSections} of {documentStats.totalSections} sections
            </Typography>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '100%',
              height: 4,
              background: 'rgba(255, 255, 255, 0.3)',
            }}
          >
            <Box
              sx={{
                width: `${completionPercentage}%`,
                height: '100%',
                background: 'rgba(255, 255, 255, 0.8)',
                transition: 'width 0.5s ease',
              }}
            />
          </Box>
        </Paper>

        {/* Word Count */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            background: '#fafbfc',
          }}
        >
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Description sx={{ fontSize: 32, color: '#10b981' }} />
            <Typography variant="h6" fontWeight={600} sx={{ color: '#2d3748' }}>
              Word Count
            </Typography>
          </Box>
          <Typography variant="h3" fontWeight={700} sx={{ color: '#1a202c', mb: 1 }}>
            {documentStats.totalWords.toLocaleString()}
          </Typography>
        </Paper>

        {/* Document Status */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            background: '#fafbfc',
          }}
        >
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Article sx={{ fontSize: 32, color: '#f59e0b' }} />
            <Typography variant="h6" fontWeight={600} sx={{ color: '#2d3748' }}>
              Status
            </Typography>
          </Box>
          <Typography
            variant="h6"
            fontWeight={600}
            sx={{
              color: completionPercentage === 100 ? '#10b981' : completionPercentage > 50 ? '#f59e0b' : '#ef4444',
              mb: 1
            }}
          >
            {completionPercentage === 100 ? 'Complete' : completionPercentage > 50 ? 'In Progress' : 'Draft'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#718096' }}>
            {completionPercentage === 100
              ? 'Ready for export'
              : `${documentStats.totalSections - documentStats.completedSections} sections remaining`
            }
          </Typography>
        </Paper>

        {/* Last Modified */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            background: '#fafbfc',
          }}
        >
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <CalendarToday sx={{ fontSize: 32, color: '#667eea' }} />
            <Typography variant="h6" fontWeight={600} sx={{ color: '#2d3748' }}>
              Last Updated
            </Typography>
          </Box>
          <Typography variant="body1" fontWeight={600} sx={{ color: '#1a202c', mb: 1 }}>
            {new Date(draft.metadata.modified_at).toLocaleDateString()}
          </Typography>
          <Typography variant="body2" sx={{ color: '#718096' }}>
            {new Date(draft.metadata.modified_at).toLocaleTimeString()}
          </Typography>
        </Paper>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' }, gap: 4 }}>
        {/* Left Panel - Document Preview */}
        <Paper
          elevation={0}
          sx={{
            border: '1px solid #e2e8f0',
            borderRadius: 3,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 600,
          }}
        >
          {/* Preview Header */}
          <Box
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
            }}
          >
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography variant="h6" fontWeight={600}>
                  Document Preview
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
                  {draft.metadata.title}
                </Typography>
              </Box>

              {/* Preview Mode Toggle */}
              <Box display="flex" alignItems="center" gap={1}>
                <Button
                  size="small"
                  onClick={() => setPreviewMode('overview')}
                  sx={{
                    minWidth: 80,
                    height: 32,
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: 2,
                    color: 'white',
                    background: previewMode === 'overview' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                    '&:hover': {
                      background: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  📊 Overview
                </Button>
                <Button
                  size="small"
                  onClick={() => setPreviewMode('content')}
                  sx={{
                    minWidth: 80,
                    height: 32,
                    fontSize: '0.75rem',
                    textTransform: 'none',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: 2,
                    color: 'white',
                    background: previewMode === 'content' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                    '&:hover': {
                      background: 'rgba(255, 255, 255, 0.1)',
                    },
                  }}
                >
                  📄 Content
                </Button>
              </Box>
            </Box>
          </Box>

          {/* Preview Content */}
          <Box sx={{
            flex: 1,
            overflow: 'auto',
            p: 3,
            // Custom scrollbar styling - neutral theme for preview
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(0, 0, 0, 0.05)',
              borderRadius: '10px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'linear-gradient(135deg, rgba(71, 85, 105, 0.6) 0%, rgba(30, 41, 59, 0.6) 100%)',
              borderRadius: '10px',
              '&:hover': {
                background: 'linear-gradient(135deg, rgba(71, 85, 105, 0.8) 0%, rgba(30, 41, 59, 0.8) 100%)',
              },
            },
            // Firefox scrollbar
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(71, 85, 105, 0.6) rgba(0, 0, 0, 0.05)',
          }}>
            {previewMode === 'overview' ? (
              // Overview Mode - Table of Contents with Status
              <Box>
                {currentToc.map((topic, topicIndex) => (
                  <Box key={topic.topic_id} sx={{ mb: 3 }}>
                    {/* Topic Header */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        mb: 1,
                        border: '1px solid #e2e8f0',
                        borderRadius: 2,
                        background: topic.content ? '#f0f9f4' : '#fef2f2',
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box display="flex" alignItems="center" gap={2}>
                          <Typography
                            variant="h6"
                            sx={{
                              color: '#2d3748',
                              fontWeight: 600,
                              fontSize: '1rem',
                            }}
                          >
                            {topicIndex + 1}. {topic.topic}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1}>
                          {topic.content ? (
                            <CheckCircle sx={{ color: '#10b981', fontSize: 20 }} />
                          ) : (
                            <Error sx={{ color: '#ef4444', fontSize: 20 }} />
                          )}
                          <Typography
                            variant="caption"
                            sx={{
                              color: topic.content ? '#10b981' : '#ef4444',
                              fontWeight: 600,
                            }}
                          >
                            {topic.content ? `${topic.content.split(/\s+/).length} words` : 'No content'}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>

                    {/* Subtopics */}
                    {topic.subtopics.map((subtopic, subIndex) => (
                      <Paper
                        key={subtopic.subtopic_id}
                        elevation={0}
                        sx={{
                          p: 2,
                          ml: 3,
                          mb: 1,
                          border: '1px solid #e2e8f0',
                          borderRadius: 2,
                          background: subtopic.content ? '#f0f9f4' : '#fef2f2',
                        }}
                      >
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography
                            variant="body1"
                            sx={{
                              color: '#4a5568',
                              fontWeight: 500,
                              fontSize: '0.9rem',
                            }}
                          >
                            {topicIndex + 1}.{subIndex + 1} {subtopic.topic}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            {subtopic.content ? (
                              <CheckCircle sx={{ color: '#10b981', fontSize: 18 }} />
                            ) : (
                              <Error sx={{ color: '#ef4444', fontSize: 18 }} />
                            )}
                            <Typography
                              variant="caption"
                              sx={{
                                color: subtopic.content ? '#10b981' : '#ef4444',
                                fontWeight: 600,
                              }}
                            >
                              {subtopic.content ? `${subtopic.content.split(/\s+/).length} words` : 'No content'}
                            </Typography>
                          </Box>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                ))}
              </Box>
            ) : (
              // Content Mode - Full Document Preview
              <Box>
                {/* Document Header */}
                <Box sx={{ mb: 4, pb: 3, borderBottom: '2px solid #e2e8f0' }}>
                  <Typography variant="h4" sx={{ color: '#1a202c', fontWeight: 700, mb: 2, textAlign: 'center' }}>
                    {draft.metadata.title}
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#64748b', mb: 3, textAlign: 'center' }}>
                    {draft.metadata.description}
                  </Typography>
                  <Box sx={{ textAlign: 'center', color: '#718096' }}>
                    <Typography variant="body2">
                      Prepared for: {draft.metadata.client_metadata.name}
                    </Typography>
                    <Typography variant="body2">
                      Created: {new Date(draft.metadata.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                </Box>

                {/* Document Content */}
                {currentToc.map((topic, topicIndex) => (
                  <Box key={topic.topic_id} sx={{ mb: 4 }}>
                    {/* Topic Title */}
                    <Typography
                      variant="h5"
                      sx={{
                        color: '#1a202c',
                        fontWeight: 700,
                        mb: 2,
                        pb: 1,
                        borderBottom: '1px solid #e2e8f0',
                      }}
                    >
                      {topicIndex + 1}. {topic.topic}
                    </Typography>

                    {/* Topic Content */}
                    {topic.content ? (
                      <Typography
                        variant="body1"
                        sx={{
                          color: '#2d3748',
                          lineHeight: 1.7,
                          mb: 3,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {topic.content}
                      </Typography>
                    ) : (
                      <Alert severity="warning" sx={{ mb: 3 }}>
                        No content generated for this section yet.
                      </Alert>
                    )}

                    {/* Subtopics */}
                    {topic.subtopics.map((subtopic, subIndex) => (
                      <Box key={subtopic.subtopic_id} sx={{ ml: 2, mb: 3 }}>
                        <Typography
                          variant="h6"
                          sx={{
                            color: '#2d3748',
                            fontWeight: 600,
                            mb: 1,
                          }}
                        >
                          {topicIndex + 1}.{subIndex + 1} {subtopic.topic}
                        </Typography>
                        {subtopic.content ? (
                          <Typography
                            variant="body1"
                            sx={{
                              color: '#4a5568',
                              lineHeight: 1.6,
                              ml: 1,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {subtopic.content}
                          </Typography>
                        ) : (
                          <Alert severity="warning" sx={{ ml: 1 }}>
                            No content generated for this subsection yet.
                          </Alert>
                        )}
                      </Box>
                    ))}
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Paper>

        {/* Right Panel - Export Options */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Export Format Selection */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid #e2e8f0',
              borderRadius: 3,
            }}
          >
            <Typography variant="h6" sx={{ color: '#2d3748', fontWeight: 600, mb: 3 }}>
              Export Format
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { format: 'word' as const, icon: InsertDriveFile, title: 'Microsoft Word', description: 'DOCX format, fully editable', color: '#2563eb' },
                { format: 'pdf' as const, icon: PictureAsPdf, title: 'PDF Document', description: 'Print-ready format', color: '#dc2626' },
              ].map(({ format, icon: Icon, title, description, color }) => (
                <Paper
                  key={format}
                  elevation={0}
                  onClick={() => setSelectedExportFormat(format)}
                  sx={{
                    p: 3,
                    border: selectedExportFormat === format ? `2px solid ${color}` : '1px solid #e2e8f0',
                    borderRadius: 2,
                    cursor: 'pointer',
                    background: selectedExportFormat === format ? `${color}08` : 'white',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      borderColor: color,
                      transform: 'translateY(-1px)',
                      boxShadow: `0 4px 12px ${color}20`,
                    },
                  }}
                >
                  <Box display="flex" alignItems="center" gap={2}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        background: color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon sx={{ color: 'white', fontSize: 24 }} />
                    </Box>
                    <Box flex={1}>
                      <Typography variant="body1" sx={{ fontWeight: 600, color: '#2d3748' }}>
                        {title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#718096' }}>
                        {description}
                      </Typography>
                    </Box>
                  </Box>
                </Paper>
              ))}
            </Box>
          </Paper>

          {/* Export Actions */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid #e2e8f0',
              borderRadius: 3,
            }}
          >
            <Typography variant="h6" sx={{ color: '#2d3748', fontWeight: 600, mb: 3 }}>
              Export Actions
            </Typography>

            {exportSuccess && (
              <Alert severity="success" sx={{ mb: 3 }}>
                Document exported successfully! ✨
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                startIcon={isExporting ? <CircularProgress size={20} color="inherit" /> : <CloudDownload />}
                onClick={handleExport}
                disabled={isExporting || completionPercentage === 0}
                sx={{
                  background: 'linear-gradient(135deg, #10b981 0%, #065f46 100%)',
                  py: 1.5,
                  fontWeight: 600,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
                  },
                }}
              >
                {isExporting ? 'Exporting...' : `Export as ${selectedExportFormat.toUpperCase()}`}
              </Button>

              <Button
                variant="outlined"
                size="large"
                startIcon={<Visibility />}
                onClick={() => setShowPreviewModal(true)}
                disabled={completionPercentage === 0}
                sx={{
                  borderColor: '#667eea',
                  color: '#667eea',
                  py: 1.5,
                  '&:hover': {
                    borderColor: '#5569d8',
                    background: 'rgba(102, 126, 234, 0.1)',
                  },
                }}
              >
                Preview Document
              </Button>

            </Box>
          </Paper>

          {/* Document Info */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid #e2e8f0',
              borderRadius: 3,
            }}
          >
            <Typography variant="h6" sx={{ color: '#2d3748', fontWeight: 600, mb: 3 }}>
              Document Information
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#718096', fontWeight: 500 }}>
                  CLIENT
                </Typography>
                <Typography variant="body2" sx={{ color: '#2d3748', fontWeight: 600 }}>
                  {draft.metadata.client_metadata.name}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: '#718096', fontWeight: 500 }}>
                  CREATED BY
                </Typography>
                <Typography variant="body2" sx={{ color: '#2d3748', fontWeight: 600 }}>
                  {draft.metadata.created_by}
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: '#718096', fontWeight: 500 }}>
                  ESTIMATED READING TIME
                </Typography>
                <Typography variant="body2" sx={{ color: '#2d3748', fontWeight: 600 }}>
                  {Math.ceil(documentStats.totalWords / 200)} minutes
                </Typography>
              </Box>

              <Box>
                <Typography variant="caption" sx={{ color: '#718096', fontWeight: 500 }}>
                  DOCUMENT ID
                </Typography>
                <Typography variant="body2" sx={{ color: '#718096', fontFamily: 'monospace' }}>
                  {draft.id}
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Document Preview Modal */}
      <Dialog
        open={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        maxWidth="lg"
        fullWidth
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            height: '90vh',
            maxHeight: '90vh',
          },
        }}
      >
        <DialogTitle sx={{ pb: 2, borderBottom: '1px solid #e2e8f0' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#1a202c' }}>
              Document Preview
            </Typography>
            <Typography variant="body2" sx={{ color: '#718096' }}>
              {draft?.metadata.title}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
          <Box sx={{
            height: '100%',
            overflow: 'auto',
            p: 4,
            background: '#fafafa',
            fontFamily: '"Times New Roman", Times, serif',
            // Custom scrollbar styling for document preview
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(0, 0, 0, 0.1)',
              borderRadius: '10px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'linear-gradient(135deg, rgba(55, 65, 81, 0.7) 0%, rgba(17, 24, 39, 0.7) 100%)',
              borderRadius: '10px',
              '&:hover': {
                background: 'linear-gradient(135deg, rgba(55, 65, 81, 0.9) 0%, rgba(17, 24, 39, 0.9) 100%)',
              },
            },
            // Firefox scrollbar
            scrollbarWidth: 'auto',
            scrollbarColor: 'rgba(55, 65, 81, 0.7) rgba(0, 0, 0, 0.1)',
          }}>
            {/* Title Page Preview */}
            <Box sx={{ mb: 6, textAlign: 'center', pb: 4, borderBottom: '2px solid #e2e8f0' }}>
              <Typography
                variant="h2"
                sx={{
                  mb: 4,
                  fontWeight: 700,
                  color: '#1a202c',
                  fontFamily: '"Times New Roman", Times, serif'
                }}
              >
                {draft?.metadata.title}
              </Typography>

              <Typography variant="h6" sx={{ mb: 2, color: '#4a5568' }}>
                Prepared for: {draft?.metadata.client_metadata.name}
              </Typography>

              <Typography variant="body2" sx={{ color: '#718096' }}>
                Created: {draft && new Date(draft.metadata.created_at).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" sx={{ color: '#718096' }}>
                Created By: {draft?.metadata.created_by}
              </Typography>
            </Box>

            {/* Table of Contents Preview */}
            <Box sx={{ mb: 6 }}>
              <Typography variant="h4" sx={{ mb: 3, fontWeight: 700, color: '#1a202c' }}>
                Table of Contents
              </Typography>

              {currentToc.map((topic, topicIndex) => (
                <Box key={topic.topic_id} sx={{ mb: 2 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, color: '#2d3748' }}>
                    {topicIndex + 1}. {topic.topic}
                  </Typography>

                  {topic.subtopics.map((subtopic, subIndex) => (
                    <Typography
                      key={subtopic.subtopic_id}
                      variant="body2"
                      sx={{ ml: 4, color: '#4a5568', mt: 0.5 }}
                    >
                      {topicIndex + 1}.{subIndex + 1} {subtopic.topic}
                    </Typography>
                  ))}
                </Box>
              ))}
            </Box>

            {/* Document Content Preview */}
            <Box>
              {currentToc.map((topic, topicIndex) => (
                <Box key={topic.topic_id} sx={{ mb: 4 }}>
                  {/* Topic Title */}
                  <Typography
                    variant="h4"
                    sx={{
                      color: '#1a202c',
                      fontWeight: 700,
                      mb: 2,
                      pb: 1,
                      borderBottom: '1px solid #e2e8f0',
                    }}
                  >
                    {topicIndex + 1}. {topic.topic}
                  </Typography>

                  {/* Topic Content */}
                  {topic.content ? (
                    <Typography
                      variant="body1"
                      sx={{
                        color: '#2d3748',
                        lineHeight: 1.8,
                        mb: 3,
                        whiteSpace: 'pre-wrap',
                        fontSize: '16px',
                      }}
                    >
                      {topic.content}
                    </Typography>
                  ) : (
                    <Alert severity="info" sx={{ mb: 3 }}>
                      <em>No content generated for this section yet.</em>
                    </Alert>
                  )}

                  {/* Subtopics */}
                  {topic.subtopics.map((subtopic, subIndex) => (
                    <Box key={subtopic.subtopic_id} sx={{ ml: 2, mb: 3 }}>
                      <Typography
                        variant="h5"
                        sx={{
                          color: '#2d3748',
                          fontWeight: 600,
                          mb: 1,
                        }}
                      >
                        {topicIndex + 1}.{subIndex + 1} {subtopic.topic}
                      </Typography>
                      {subtopic.content ? (
                        <Typography
                          variant="body1"
                          sx={{
                            color: '#4a5568',
                            lineHeight: 1.7,
                            ml: 1,
                            whiteSpace: 'pre-wrap',
                            fontSize: '16px',
                          }}
                        >
                          {subtopic.content}
                        </Typography>
                      ) : (
                        <Alert severity="info" sx={{ ml: 1 }}>
                          <em>No content generated for this subsection yet.</em>
                        </Alert>
                      )}
                    </Box>
                  ))}
                </Box>
              ))}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 3, borderTop: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => setShowPreviewModal(false)}
            variant="outlined"
            sx={{ mr: 2 }}
          >
            Close Preview
          </Button>
          <Button
            onClick={() => {
              setShowPreviewModal(false);
              // Trigger export after closing modal
              setTimeout(() => {
                handleExport();
              }, 100);
            }}
            variant="contained"
            startIcon={<CloudDownload />}
            sx={{
              background: 'linear-gradient(135deg, #10b981 0%, #065f46 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
              },
            }}
          >
            Export as {selectedExportFormat.toUpperCase()}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const DraftEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  // Get TOC source from draft metadata (persistent) or navigation state (temporary for new drafts)
  const [tocSource, setTocSource] = useState<'similarity_search' | 'ai_generated' | null>(
    location.state?.tocSource || null
  );

  // Drag and Drop sensors with activation constraints
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // TOC Management state
  const [editingTopic, setEditingTopic] = useState<{ id: string; text: string; isSubtopic: boolean } | null>(null);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newTopicText, setNewTopicText] = useState('');
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  // TOC Chat Mode state
  const [tocChatMode, setTocChatMode] = useState(true); // Default to true since it's now in TOC tab
  const [tocPreview, setTocPreview] = useState<Draft['toc'] | null>(null);
  const [pendingTocOperation, setPendingTocOperation] = useState<any>(null);
  const [tocChatHistory, setTocChatHistory] = useState<Array<{ user_message: string; ai_response: string }>>([]);
  const [tocChatInput, setTocChatInput] = useState('');
  const [tocGeneratingTopics, setTocGeneratingTopics] = useState<Set<string>>(new Set());
  const tocChatEndRef = useRef<HTMLDivElement>(null);

  // Track changes for save functionality
  const [originalToc, setOriginalToc] = useState<Draft['toc'] | null>(null);
  const [currentToc, setCurrentToc] = useState<Draft['toc']>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Centralized Content Generation State
  const [centralizedState, setCentralizedState] = useState<{
    selectedItem: {
      id: string;
      type: 'topic' | 'subtopic';
      title: string;
      content: string;
      conversation_history: ConversationEntry[];
      parentTopicId?: string;
    } | null;
    conversations: Record<string, ExtendedConversationEntry[]>; // Key: topicId or subtopicId
    generatedContent: Record<string, string>; // Key: topicId or subtopicId
    currentContent: Record<string, string>; // Key: topicId or subtopicId (saved content)
    hasUnsavedContent: Record<string, boolean>; // Key: topicId or subtopicId
    lastSavedAt: Record<string, number>; // Key: topicId or subtopicId, Value: timestamp
  }>({
    selectedItem: null,
    conversations: {},
    generatedContent: {},
    currentContent: {},
    hasUnsavedContent: {},
    lastSavedAt: {},
  });

  // Notification state
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [showErrorNotification, setShowErrorNotification] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const loadDraft = React.useCallback(async (draftId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await draftService.getDraft(draftId);
      setDraft(data);
      // Initialize TOC states
      setOriginalToc(JSON.parse(JSON.stringify(data.toc))); // Deep copy
      setCurrentToc(JSON.parse(JSON.stringify(data.toc))); // Deep copy
      setHasUnsavedChanges(false);
      // Load TOC source from draft metadata
      if (data.metadata?.toc_source) {
        setTocSource(data.metadata.toc_source as 'similarity_search' | 'ai_generated');
      }
      // Initialize centralized content generation state will be called separately
    } catch (err) {
      setError('Failed to load draft. Please try again.');
      console.error('Error loading draft:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      loadDraft(id);
    }
  }, [id, loadDraft]);

  // Handle TOC Chat Messages
  const handleTocChatMessage = React.useCallback(async (
    chatInput: string,
    setChatInput: (input: string) => void,
    setGeneratingTopics: React.Dispatch<React.SetStateAction<Set<string>>>,
    setError: (error: string | null) => void
  ) => {
    if (!chatInput.trim() || !draft) return;

    const userMessage = chatInput.trim();
    setChatInput('');

    // Add user message immediately to chat history with a loading state
    setTocChatHistory(prev => [
      ...prev,
      {
        user_message: userMessage,
        ai_response: '...' // Temporary loading indicator
      }
    ]);

    setGeneratingTopics(prev => {
      const newSet = new Set(prev);
      newSet.add('toc-chat'); // Use special ID for TOC chat
      return newSet;
    });
    setError(null);

    try {
      // Call TOC chat endpoint
      const response = await draftService.chatModifyToc(
        draft.id,
        userMessage,
        tocChatHistory
      );

      if (response.success) {
        // Update the last message with the actual AI response
        setTocChatHistory(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            user_message: userMessage,
            ai_response: response.message
          };
          return updated;
        });

        // Set preview if operation was parsed
        if (response.preview_toc) {
          setTocPreview(response.preview_toc);
        }

        // Store pending operation for user to confirm
        if (response.operation) {
          setPendingTocOperation(response.operation);
        }

        // Show follow-up question or suggestions
        if (response.follow_up_question) {
          // Could show this in a tooltip or info box
          console.log('Follow-up:', response.follow_up_question);
        }

        // Note: All operations now require confirmation, so no auto-apply
        // User must click the "Apply" button to confirm changes
      } else {
        setError(response.message);
      }
    } catch (error: any) {
      console.error('TOC chat failed:', error);
      setError(error.response?.data?.detail || error.message || 'Failed to process TOC command');
    } finally {
      setGeneratingTopics(prev => {
        const newSet = new Set(prev);
        newSet.delete('toc-chat');
        return newSet;
      });
    }
  }, [draft, tocChatHistory]);

  // Confirm and apply TOC modification
  const confirmTocModification = React.useCallback(async () => {
    if (!pendingTocOperation || !draft || !tocPreview) return;

    try {
      const response = await draftService.confirmTocModification(
        draft.id,
        pendingTocOperation,
        currentToc
      );

      if (response.success) {
        // Update the TOC
        setCurrentToc(response.updated_toc);

        // Also update the draft object's TOC
        setDraft(prevDraft => {
          if (!prevDraft) return prevDraft;
          return {
            ...prevDraft,
            toc: response.updated_toc
          };
        });

        setHasUnsavedChanges(true);

        // Clear preview and pending operation
        setTocPreview(null);
        setPendingTocOperation(null);

        // Show success message
        setShowSuccessNotification(true);
      } else {
        console.error('Failed to apply changes:', response.message);
        setErrorMessage(response.message || 'Failed to apply changes');
        setShowErrorNotification(true);
      }
    } catch (error: any) {
      console.error('TOC confirmation failed:', error);
      setErrorMessage(error.response?.data?.detail || error.message || 'Failed to apply TOC changes');
      setShowErrorNotification(true);
    }
  }, [pendingTocOperation, draft, tocPreview, currentToc]);

  // Auto-scroll to bottom when chat history updates
  useEffect(() => {
    if (tocChatEndRef.current) {
      tocChatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tocChatHistory]);

  // Initialize centralized state when draft is loaded
  useEffect(() => {
    if (draft && draft.toc) {
      // This will be called after initializeCentralizedState is defined
      const initializeState = () => {
        const conversations: Record<string, ExtendedConversationEntry[]> = {};
        const generatedContent: Record<string, string> = {};
        const currentContent: Record<string, string> = {};

        // Process topics and subtopics
        draft.toc.forEach(topic => {
          const topicId = topic.topic_id;
          conversations[topicId] = (topic.conversation_history || []).map(entry => ({
            ...entry,
            full_content: entry.ai_response,
            summary: entry.ai_response?.length > 100 ? entry.ai_response.substring(0, 100) + '...' : entry.ai_response
          }));
          generatedContent[topicId] = topic.content || '';
          currentContent[topicId] = topic.content || '';

          // Process subtopics
          topic.subtopics?.forEach(subtopic => {
            const subtopicId = subtopic.subtopic_id;
            conversations[subtopicId] = (subtopic.conversation_history || []).map(entry => ({
              ...entry,
              full_content: entry.ai_response,
              summary: entry.ai_response?.length > 100 ? entry.ai_response.substring(0, 100) + '...' : entry.ai_response
            }));
            generatedContent[subtopicId] = subtopic.content || '';
            currentContent[subtopicId] = subtopic.content || '';
          });
        });

        // Set initial selected item to first topic
        const firstTopic = draft.toc[0];
        const selectedItem = firstTopic ? {
          id: firstTopic.topic_id,
          type: 'topic' as const,
          title: firstTopic.topic,
          content: firstTopic.content || '',
          conversation_history: firstTopic.conversation_history || []
        } : null;

        setCentralizedState({
          selectedItem,
          conversations,
          generatedContent,
          currentContent,
          hasUnsavedContent: {},
          lastSavedAt: {}
        });
      };

      initializeState();
    }
  }, [draft]);

  // Centralized Content Generation State Management Functions
  const updateSelectedItem = useCallback((item: {
    id: string;
    type: 'topic' | 'subtopic';
    title: string;
    content: string;
    conversation_history: ConversationEntry[];
    parentTopicId?: string;
  } | null) => {
    setCentralizedState(prev => ({
      ...prev,
      selectedItem: item
    }));
  }, []);

  const updateConversationHistory = useCallback((itemId: string, history: ExtendedConversationEntry[]) => {
    // Update centralized state
    setCentralizedState(prev => ({
      ...prev,
      conversations: {
        ...prev.conversations,
        [itemId]: history
      }
    }));

    // Also update currentToc to keep it in sync
    setCurrentToc(prev => prev.map(topic => {
      // Check if this is a topic update
      if (topic.topic_id === itemId) {
        return {
          ...topic,
          conversation_history: history.map(entry => ({
            user_message: entry.user_message,
            ai_response: entry.ai_response || entry.full_content || '',
            timestamp: entry.timestamp
          }))
        };
      }

      // Check subtopics
      const updatedSubtopics = topic.subtopics?.map(subtopic => {
        if (subtopic.subtopic_id === itemId) {
          return {
            ...subtopic,
            conversation_history: history.map(entry => ({
              user_message: entry.user_message,
              ai_response: entry.ai_response || entry.full_content || '',
              timestamp: entry.timestamp
            }))
          };
        }
        return subtopic;
      });

      if (updatedSubtopics) {
        return { ...topic, subtopics: updatedSubtopics };
      }

      return topic;
    }));
  }, []);

  const updateGeneratedContent = useCallback((itemId: string, content: string) => {
    setCentralizedState(prev => ({
      ...prev,
      generatedContent: {
        ...prev.generatedContent,
        [itemId]: content
      }
    }));
  }, []);

  const updateCurrentContent = useCallback((itemId: string, content: string) => {
    setCentralizedState(prev => ({
      ...prev,
      currentContent: {
        ...prev.currentContent,
        [itemId]: content
      }
    }));
  }, []);

  const markContentAsUnsaved = useCallback((itemId: string) => {
    setCentralizedState(prev => ({
      ...prev,
      hasUnsavedContent: {
        ...prev.hasUnsavedContent,
        [itemId]: true
      }
    }));
  }, []);

  const markContentAsSaved = useCallback((itemId: string) => {
    setCentralizedState(prev => ({
      ...prev,
      hasUnsavedContent: {
        ...prev.hasUnsavedContent,
        [itemId]: false
      },
      lastSavedAt: {
        ...prev.lastSavedAt,
        [itemId]: Date.now()
      }
    }));
  }, []);

  // Debounced auto-save functionality
  const autoSaveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const [autoSaving, setAutoSaving] = useState<Record<string, boolean>>({});

  const triggerAutoSave = useCallback(async (itemId: string) => {
    if (!draft) return;

    const generatedContent = centralizedState.generatedContent[itemId];
    const conversationHistory = centralizedState.conversations[itemId];
    const selectedItem = centralizedState.selectedItem;

    if (!selectedItem || selectedItem.id !== itemId || !generatedContent?.trim()) return;

    try {
      setAutoSaving(prev => ({ ...prev, [itemId]: true }));

      const topicIdForApi = selectedItem.type === 'topic'
        ? selectedItem.id
        : selectedItem.parentTopicId || selectedItem.id;

      await draftService.updateContent(
        draft.id,
        topicIdForApi,
        generatedContent,
        selectedItem.type === 'subtopic' ? selectedItem.id : undefined,
        conversationHistory || []
      );

      // Update TOC to reflect the saved content
      if (currentToc) {
        const updatedToc = currentToc.map(topic => {
          if (selectedItem.type === 'topic' && topic.topic_id === selectedItem.id) {
            return {
              ...topic,
              content: generatedContent,
              conversation_history: conversationHistory || []
            };
          } else if (selectedItem.type === 'subtopic') {
            const updatedSubtopics = topic.subtopics.map(subtopic => {
              if (subtopic.subtopic_id === selectedItem.id) {
                return {
                  ...subtopic,
                  content: generatedContent,
                  conversation_history: conversationHistory || []
                };
              }
              return subtopic;
            });
            return { ...topic, subtopics: updatedSubtopics };
          }
          return topic;
        });
        setCurrentToc(updatedToc);
      }

      markContentAsSaved(itemId);
      updateCurrentContent(itemId, generatedContent);

    } catch (error) {
      console.error('Auto-save failed:', error);
      // Keep content marked as unsaved if auto-save fails
    } finally {
      setAutoSaving(prev => ({ ...prev, [itemId]: false }));
    }
  }, [draft, centralizedState, currentToc, markContentAsSaved, updateCurrentContent]);

  const debouncedAutoSave = useCallback((itemId: string) => {
    // Clear existing timeout
    if (autoSaveTimeouts.current[itemId]) {
      clearTimeout(autoSaveTimeouts.current[itemId]);
    }

    // Set new timeout for auto-save (5 seconds after last change)
    autoSaveTimeouts.current[itemId] = setTimeout(() => {
      triggerAutoSave(itemId);
    }, 5000);
  }, [triggerAutoSave]);

  // Enhanced updateGeneratedContent with auto-save
  const updateGeneratedContentWithAutoSave = useCallback((itemId: string, content: string) => {
    setCentralizedState(prev => ({
      ...prev,
      generatedContent: {
        ...prev.generatedContent,
        [itemId]: content
      }
    }));

    // Mark as unsaved
    markContentAsUnsaved(itemId);

    // Trigger debounced auto-save
    if (content.trim()) {
      debouncedAutoSave(itemId);
    }
  }, [markContentAsUnsaved, debouncedAutoSave]);

  // Initialize centralized state when draft loads
  const initializeCentralizedState = useCallback((draftData: Draft) => {
    const conversations: Record<string, ExtendedConversationEntry[]> = {};
    const generatedContent: Record<string, string> = {};
    const currentContent: Record<string, string> = {};

    // Process topics and subtopics
    draftData.toc.forEach(topic => {
      const topicId = topic.topic_id;
      conversations[topicId] = (topic.conversation_history || []).map(entry => ({
        ...entry,
        full_content: entry.ai_response,
        summary: entry.ai_response?.length > 100 ? entry.ai_response.substring(0, 100) + '...' : entry.ai_response
      }));
      generatedContent[topicId] = topic.content || '';
      currentContent[topicId] = topic.content || '';

      // Process subtopics
      topic.subtopics?.forEach(subtopic => {
        const subtopicId = subtopic.subtopic_id;
        conversations[subtopicId] = (subtopic.conversation_history || []).map(entry => ({
          ...entry,
          full_content: entry.ai_response,
          summary: entry.ai_response?.length > 100 ? entry.ai_response.substring(0, 100) + '...' : entry.ai_response
        }));
        generatedContent[subtopicId] = subtopic.content || '';
        currentContent[subtopicId] = subtopic.content || '';
      });
    });

    // Set initial selected item to first topic
    const firstTopic = draftData.toc[0];
    const selectedItem = firstTopic ? {
      id: firstTopic.topic_id,
      type: 'topic' as const,
      title: firstTopic.topic,
      content: firstTopic.content || '',
      conversation_history: firstTopic.conversation_history || []
    } : null;

    setCentralizedState({
      selectedItem,
      conversations,
      generatedContent,
      currentContent,
      hasUnsavedContent: {},
      lastSavedAt: {}
    });
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Utility function to check if TOC has changes
  const checkForChanges = (newToc: Draft['toc']) => {
    const hasChanges = JSON.stringify(originalToc) !== JSON.stringify(newToc);
    setHasUnsavedChanges(hasChanges);
    return hasChanges;
  };

  // TOC Management functions
  const toggleTopicExpansion = (topicId: string) => {
    setExpandedTopics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(topicId)) {
        newSet.delete(topicId);
      } else {
        newSet.add(topicId);
      }
      return newSet;
    });
  };

  const handleEditTopic = (id: string, currentText: string, isSubtopic: boolean = false) => {
    setEditingTopic({ id, text: currentText, isSubtopic });
  };

  const handleSaveEdit = () => {
    if (editingTopic && draft) {
      const newToc = [...currentToc];

      if (editingTopic.isSubtopic) {
        // Update subtopic
        for (const topic of newToc) {
          const subtopicIndex = topic.subtopics.findIndex(sub => sub.subtopic_id === editingTopic.id);
          if (subtopicIndex !== -1) {
            topic.subtopics[subtopicIndex] = {
              ...topic.subtopics[subtopicIndex],
              topic: editingTopic.text
            };
            break;
          }
        }
      } else {
        // Update main topic
        const topicIndex = newToc.findIndex(topic => topic.topic_id === editingTopic.id);
        if (topicIndex !== -1) {
          newToc[topicIndex] = {
            ...newToc[topicIndex],
            topic: editingTopic.text
          };
        }
      }

      setCurrentToc(newToc);
      checkForChanges(newToc);
      setEditingTopic(null);
    }
  };

  const handleDeleteTopic = (id: string, isSubtopic: boolean = false) => {
    if (window.confirm(`Are you sure you want to delete this ${isSubtopic ? 'subtopic' : 'topic'}?`)) {
      const newToc = [...currentToc];

      if (isSubtopic) {
        // Delete subtopic
        for (const topic of newToc) {
          const subtopicIndex = topic.subtopics.findIndex(sub => sub.subtopic_id === id);
          if (subtopicIndex !== -1) {
            topic.subtopics.splice(subtopicIndex, 1);
            break;
          }
        }
      } else {
        // Delete main topic
        const topicIndex = newToc.findIndex(topic => topic.topic_id === id);
        if (topicIndex !== -1) {
          newToc.splice(topicIndex, 1);
        }
      }

      setCurrentToc(newToc);
      checkForChanges(newToc);
    }
  };

  const handleAddNewTopic = () => {
    if (newTopicText.trim()) {
      const newTopic = {
        topic_id: `temp_${Date.now()}`, // Temporary ID
        topic: newTopicText.trim(),
        order: currentToc.length + 1,
        content: '',
        summary: '',
        conversation_history: [],
        subtopics: []
      };

      const newToc = [...currentToc, newTopic];
      setCurrentToc(newToc);
      checkForChanges(newToc);
      setNewTopicText('');
      setOpenAddDialog(false);
    }
  };

  const handleAddNewSubtopic = (topicId: string, subtopicText: string) => {
    if (subtopicText.trim()) {
      const newSubtopic = {
        subtopic_id: `temp_${Date.now()}`, // Temporary ID
        topic: subtopicText.trim(),
        order: 0, // Will be set based on current subtopics length
        content: '',
        summary: '',
        conversation_history: []
      };

      const newToc = currentToc.map(topic => {
        if (topic.topic_id === topicId) {
          const updatedSubtopics = [...topic.subtopics, newSubtopic].map((subtopic, index) => ({
            ...subtopic,
            order: index + 1
          }));
          return {
            ...topic,
            subtopics: updatedSubtopics
          };
        }
        return topic;
      });

      setCurrentToc(newToc);
      checkForChanges(newToc);
    }
  };

  // Handle drag end for reordering topics
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = currentToc.findIndex((item) => item.topic_id === active.id);
      const newIndex = currentToc.findIndex((item) => item.topic_id === over?.id);

      const newToc = arrayMove(currentToc, oldIndex, newIndex).map((topic, index) => ({
        ...topic,
        order: index + 1
      }));

      setCurrentToc(newToc);
      checkForChanges(newToc);
    }
  };

  // Handle drag end for reordering subtopics within a topic
  const handleSubtopicDragEnd = (event: DragEndEvent, topicId: string) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const newToc = [...currentToc];
      const topicIndex = newToc.findIndex(topic => topic.topic_id === topicId);

      if (topicIndex !== -1) {
        const subtopics = [...newToc[topicIndex].subtopics];
        const oldIndex = subtopics.findIndex(subtopic => subtopic.subtopic_id === active.id);
        const newIndex = subtopics.findIndex(subtopic => subtopic.subtopic_id === over?.id);

        const reorderedSubtopics = arrayMove(subtopics, oldIndex, newIndex).map((subtopic, index) => ({
          ...subtopic,
          order: index + 1
        }));

        newToc[topicIndex] = {
          ...newToc[topicIndex],
          subtopics: reorderedSubtopics
        };

        setCurrentToc(newToc);
        checkForChanges(newToc);
      }
    }
  };

  // Save TOC changes to backend
  const handleSaveToc = async () => {
    if (!draft || !hasUnsavedChanges) return;

    setSaving(true);
    try {
      // Transform currentToc to match API format
      const tocForApi = currentToc.map((topic, index) => ({
        id: topic.topic_id,
        topic: topic.topic,
        order: index + 1,
        source_topic_id: topic.source_topic_id,
        subtopics: topic.subtopics.map((subtopic, subIndex) => ({
          id: subtopic.subtopic_id,
          topic: subtopic.topic,
          order: subIndex + 1,
          source_subtopic_id: subtopic.source_subtopic_id
        }))
      }));

      await draftService.updateTOC(draft.id, { toc: tocForApi });

      // Update the original state and draft
      setOriginalToc(JSON.parse(JSON.stringify(currentToc)));
      setDraft({
        ...draft,
        toc: currentToc
      });
      setHasUnsavedChanges(false);

      // Show success notification
      setShowSuccessNotification(true);
    } catch (error: any) {
      console.error('Failed to save TOC:', error);
      setErrorMessage(error.response?.data?.detail || 'Failed to save changes. Please try again.');
      setShowErrorNotification(true);
    } finally {
      setSaving(false);
    }
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
        <Button onClick={() => navigate('/drafts')}>Back to Drafts</Button>
      </Box>
    );
  }

  if (!draft) {
    return null;
  }

  return (
    <Container maxWidth="xl">
      {/* Header Section */}
      <Paper
        elevation={0}
        sx={{
          py: 1,
          px: 2,
          mb: 1,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          borderRadius: 2,
        }}
      >
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            startIcon={<ArrowBack />}
            onClick={() => navigate('/drafts')}
            size="small"
            sx={{
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.1)',
              },
            }}
          >
            Back
          </Button>
          <Typography variant="body1" component="h1" fontWeight={700} noWrap>
            {draft.metadata.title}
          </Typography>
        </Box>
      </Paper>

      {/* Tabs Section */}
      <Paper
        elevation={0}
        sx={{
          mb: 1,
          borderRadius: 2,
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%)',
          border: '1px solid rgba(102, 126, 234, 0.1)',
          overflow: 'hidden',
        }}
      >
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant={isMobile ? 'scrollable' : 'fullWidth'}
          scrollButtons={isMobile ? 'auto' : false}
          sx={{
            minHeight: 40,
            px: { xs: 0, md: 1 },
            '& .MuiTabs-flexContainer': {
              gap: 0.5,
            },
            '& .MuiTab-root': {
              fontWeight: 600,
              fontSize: '0.8rem',
              textTransform: 'none',
              minHeight: 40,
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              color: '#64748b',
              transition: 'all 0.3s ease',
              position: 'relative',
              '&:hover': {
                background: 'rgba(102, 126, 234, 0.08)',
                color: '#667eea',
                transform: 'translateY(-2px)',
              },
              '& .MuiSvgIcon-root': {
                fontSize: 18,
                mb: 0,
              },
            },
            '& .Mui-selected': {
              color: '#ffffff !important',
              background: 'linear-gradient(135deg, #8b9df5 0%, #a588c9 100%)',
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.25)',
              '& .MuiSvgIcon-root': {
                color: '#ffffff !important',
              },
              '&:hover': {
                background: 'linear-gradient(135deg, #7c8ef5 0%, #9d7fc4 100%)',
                transform: 'translateY(-2px)',
              },
            },
            '& .MuiTabs-indicator': {
              display: 'none',
            },
          }}
        >
          <Tab
            icon={<Assessment />}
            iconPosition="start"
            label="Overview"
          />
          <Tab
            icon={<Description />}
            iconPosition="start"
            label="Table of Contents"
          />
          <Tab
            icon={<EditNote />}
            iconPosition="start"
            label="Content Generation"
          />
          <Tab
            icon={<Visibility />}
            iconPosition="start"
            label="Export & Preview"
          />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Box sx={{ maxWidth: '1200px' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
            <Typography variant="h5" fontWeight={600} sx={{ color: '#1a202c' }}>
              Draft Overview
            </Typography>
            <Button
              variant="contained"
              startIcon={<Edit />}
              onClick={() => navigate('/drafts/new', { state: { editDraft: draft } })}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                textTransform: 'none',
                px: 3,
                fontWeight: 600,
                '&:hover': {
                  background: 'linear-gradient(135deg, #5569d8 0%, #6a4291 100%)',
                },
              }}
            >
              Edit Metadata
            </Button>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            {/* Policy Details & Requirements */}
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 3,
                border: '1px solid rgba(102, 126, 234, 0.2)',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.04) 0%, rgba(118, 75, 162, 0.04) 100%)',
                gridColumn: { xs: '1', md: '1 / -1' },
              }}
            >
              <Box display="flex" alignItems="center" gap={2} mb={4}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Article sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Typography variant="h6" fontWeight={600} sx={{ color: '#2d3748' }}>
                  Policy Details & Requirements
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr 1fr' }, gap: 4, mb: 3 }}>
                {/* Title */}
                <Box>
                  <Typography variant="body2" sx={{
                    color: '#667eea',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontSize: '0.9rem',
                    mb: 1
                  }}>
                    Title
                  </Typography>
                  <Typography variant="body1" sx={{ color: '#2d3748', lineHeight: 1.5, fontSize: '1.05rem' }}>
                    {draft.metadata.title}
                  </Typography>
                </Box>

                {/* Policy Function */}
                {draft.metadata.function && (
                  <Box>
                    <Typography variant="body2" sx={{
                      color: '#667eea',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: '0.9rem',
                      mb: 1
                    }}>
                      Function
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#2d3748', lineHeight: 1.5, fontSize: '1.05rem' }}>
                      {draft.metadata.function}
                    </Typography>
                  </Box>
                )}

                {/* Regulations */}
                {draft.metadata.regulations && (
                  <Box>
                    <Typography variant="body2" sx={{
                      color: '#667eea',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: '0.9rem',
                      mb: 1
                    }}>
                      Regulations
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#2d3748', lineHeight: 1.5, fontSize: '1.05rem' }}>
                      {draft.metadata.regulations}
                    </Typography>
                  </Box>
                )}

                {/* Detail Level */}
                {draft.metadata.detail_level && (
                  <Box>
                    <Typography variant="body2" sx={{
                      color: '#667eea',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: '0.9rem',
                      mb: 1
                    }}>
                      Detail Level
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#2d3748', lineHeight: 1.5, fontSize: '1.05rem' }}>
                      Level {draft.metadata.detail_level} of 5
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Long text fields */}
              {(draft.metadata.client_specific_requests || draft.metadata.sector_specific_comments) && (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4, pt: 3, mt: 3, borderTop: '2px solid rgba(102, 126, 234, 0.15)' }}>
                  {draft.metadata.client_specific_requests && (
                    <Box>
                      <Typography variant="body2" sx={{
                        color: '#667eea',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontSize: '0.9rem',
                        mb: 1.5
                      }}>
                        Client Specific Requirements
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#2d3748', lineHeight: 1.7, fontSize: '1rem' }}>
                        {draft.metadata.client_specific_requests}
                      </Typography>
                    </Box>
                  )}

                  {draft.metadata.sector_specific_comments && (
                    <Box>
                      <Typography variant="body2" sx={{
                        color: '#667eea',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontSize: '0.9rem',
                        mb: 1.5
                      }}>
                        Sector Comments
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#2d3748', lineHeight: 1.7, fontSize: '1rem' }}>
                        {draft.metadata.sector_specific_comments}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </Paper>

            {/* Client Information */}
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 3,
                border: '1px solid rgba(16, 185, 129, 0.2)',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.04) 0%, rgba(6, 95, 70, 0.04) 100%)',
              }}
            >
              <Box display="flex" alignItems="center" gap={2} mb={4}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #10b981 0%, #065f46 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Business sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Typography variant="h6" fontWeight={600} sx={{ color: '#2d3748' }}>
                  Client Information
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Client Name and Industry side by side */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3, width: '100%' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{
                      color: '#10b981',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: '0.9rem',
                      mb: 1
                    }}>
                      Client Name
                    </Typography>
                    <Typography variant="body1" sx={{ color: '#2d3748', fontSize: '1.1rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {draft.metadata.client_metadata.name}
                    </Typography>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{
                      color: '#10b981',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: '0.9rem',
                      mb: 1
                    }}>
                      Industry
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#2d3748', fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {draft.metadata.client_metadata.industry || 'N/A'}
                    </Typography>
                  </Box>
                </Box>

                {/* Country and City side by side */}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3, width: '100%' }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{
                      color: '#10b981',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: '0.9rem',
                      mb: 1
                    }}>
                      Country
                    </Typography>
                    <Box display="flex" alignItems="center" gap={1}>
                      <LocationOn sx={{ fontSize: 20, color: '#10b981' }} />
                      <Typography variant="body2" sx={{ color: '#2d3748', fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {draft.metadata.client_metadata.country}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{
                      color: '#10b981',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: '0.9rem',
                      mb: 1
                    }}>
                      City
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#2d3748', fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {draft.metadata.client_metadata.city || 'N/A'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>

            {/* Timeline Information */}
            <Paper
              elevation={0}
              sx={{
                p: 4,
                borderRadius: 3,
                border: '1px solid rgba(245, 158, 11, 0.2)',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, rgba(217, 119, 6, 0.06) 100%)',
              }}
            >
              <Box display="flex" alignItems="center" gap={2} mb={4}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CalendarToday sx={{ color: 'white', fontSize: 24 }} />
                </Box>
                <Typography variant="h6" fontWeight={600} sx={{ color: '#2d3748' }}>
                  Timeline
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr 1fr' }, gap: 4 }}>
                <Box>
                  <Typography variant="body2" sx={{
                    color: '#f59e0b',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontSize: '0.9rem',
                    mb: 1
                  }}>
                    Created
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#2d3748', fontSize: '1.05rem', fontWeight: 500 }}>
                    {new Date(draft.metadata.created_at).toLocaleDateString()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#718096', fontSize: '0.85rem' }}>
                    {new Date(draft.metadata.created_at).toLocaleTimeString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{
                    color: '#f59e0b',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontSize: '0.9rem',
                    mb: 1
                  }}>
                    Last Modified
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#2d3748', fontSize: '1.05rem', fontWeight: 500 }}>
                    {new Date(draft.metadata.modified_at).toLocaleDateString()}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#718096', fontSize: '0.85rem' }}>
                    {new Date(draft.metadata.modified_at).toLocaleTimeString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" sx={{
                    color: '#f59e0b',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontSize: '0.9rem',
                    mb: 1
                  }}>
                    Author
                  </Typography>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Person sx={{ fontSize: 20, color: '#f59e0b' }} />
                    <Typography variant="body2" sx={{ color: '#2d3748', fontSize: '1.05rem' }}>
                      {draft.metadata.created_by}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, height: { xs: 'auto', md: 'calc(100vh - 300px)' }, minHeight: { md: 600 } }}>
          {/* Left Panel - TOC Management */}
          <Box sx={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: { xs: 400, md: 'auto' } }}>
            {/* TOC Header */}
            <Box mb={3}>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Box>
                  <Typography variant="h5" fontWeight={600} sx={{ color: '#1a202c' }}>
                    Table of Contents
                  </Typography>
                </Box>
                {tocSource === 'ai_generated' && (
                  <Tooltip title="This table of contents was generated by AI based on your description">
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                      }}
                    >
                      <AutoAwesome sx={{ fontSize: 16 }} />
                      <Typography variant="caption" fontWeight={600}>
                        AI Generated
                      </Typography>
                    </Box>
                  </Tooltip>
                )}
                {tocSource === 'similarity_search' && (
                  <Tooltip title="This table of contents is based on similar existing policies">
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1.5,
                        py: 0.5,
                        borderRadius: 2,
                        background: '#10b981',
                        color: 'white',
                      }}
                    >
                      <Source sx={{ fontSize: 16 }} />
                      <Typography variant="caption" fontWeight={600}>
                        Template Based
                      </Typography>
                    </Box>
                  </Tooltip>
                )}
              </Box>
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setOpenAddDialog(true)}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
              }}
            >
              Add New Topic
            </Button>

            <Typography variant="body2" sx={{ color: '#64748b', mb: 4, mt: 3 }}>
              {tocSource === 'ai_generated'
                ? 'AI has suggested this structure based on your policy description. You can customize it as needed.'
                : 'Organize your policy document structure. Click and drag to reorder, edit titles, or delete sections as needed.'}
            </Typography>

            {/* Scrollable TOC Area */}
            <Box sx={{ flex: 1, overflow: 'auto', pr: 2 }}>
          {/* TOC Items with Drag and Drop */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={currentToc.map(topic => topic.topic_id)}
              strategy={verticalListSortingStrategy}
            >
              <Box sx={{ space: 2 }}>
                {currentToc.map((topic, index) => (
                  <SortableTopic
                    key={topic.topic_id}
                    topic={topic}
                    index={index}
                    editingTopic={editingTopic}
                    expandedTopics={expandedTopics}
                    onToggleExpansion={toggleTopicExpansion}
                    onEditTopic={handleEditTopic}
                    onDeleteTopic={handleDeleteTopic}
                    onSaveEdit={handleSaveEdit}
                    setEditingTopic={setEditingTopic}
                    onAddSubtopic={handleAddNewSubtopic}
                    onSubtopicDragEnd={handleSubtopicDragEnd}
                  />
                ))}
              </Box>
            </SortableContext>
          </DndContext>

          {/* Add Topic Dialog */}
          <Dialog
            open={openAddDialog}
            onClose={() => setOpenAddDialog(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle sx={{ fontWeight: 600 }}>Add New Topic</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                fullWidth
                label="Topic Title"
                value={newTopicText}
                onChange={(e) => setNewTopicText(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddNewTopic()}
                variant="outlined"
                sx={{ mt: 2 }}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenAddDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddNewTopic}
                variant="contained"
                disabled={!newTopicText.trim()}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                }}
              >
                Add Topic
              </Button>
            </DialogActions>
          </Dialog>
            </Box>

            {/* Save TOC Button */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSaveToc}
              disabled={!hasUnsavedChanges || saving}
              sx={{
                background: hasUnsavedChanges || saving
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'rgba(255,255,255,0.9)',
                color: hasUnsavedChanges || saving ? 'white' : '#667eea',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                border: hasUnsavedChanges || saving ? 'none' : '2px solid rgba(102, 126, 234, 0.3)',
                boxShadow: hasUnsavedChanges || saving ? '0 4px 12px rgba(102, 126, 234, 0.25)' : 'none',
                '&:hover': {
                  background: hasUnsavedChanges || saving
                    ? 'linear-gradient(135deg, #5569d8 0%, #6a4291 100%)'
                    : 'rgba(255,255,255,1)',
                  transform: hasUnsavedChanges && !saving ? 'translateY(-2px)' : 'none',
                  boxShadow: hasUnsavedChanges || saving ? '0 6px 16px rgba(102, 126, 234, 0.3)' : '0 2px 8px rgba(102, 126, 234, 0.15)',
                },
                '&.Mui-disabled': {
                  background: saving
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.6) 0%, rgba(118, 75, 162, 0.6) 100%)'
                    : 'rgba(255,255,255,0.5)',
                  color: saving ? 'white' : 'rgba(102, 126, 234, 0.5)',
                },
                transition: 'all 0.3s ease',
              }}
            >
              {saving ? 'Saving Changes...' : hasUnsavedChanges ? 'Save TOC Changes' : 'No Changes'}
            </Button>
            </Box>
          </Box>

          {/* Right Panel - AI Chat for TOC */}
          <Box sx={{
            flex: '1 1 50%',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: { xs: 'none', md: '1px solid #e2e8f0' },
            borderTop: { xs: '1px solid #e2e8f0', md: 'none' },
            pl: { xs: 0, md: 3 },
            pt: { xs: 2, md: 0 },
            overflow: 'hidden',
            minHeight: { xs: 400, md: 'auto' },
          }}>
            {/* Chat Header - More Compact */}
            <Box sx={{
              mb: 2,
              pb: 1.5,
              borderBottom: '2px solid #e2e8f0'
            }}>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Box>
                  <Typography variant="h6" fontWeight={600} sx={{ color: '#1a202c' }}>
                    AI TOC Assistant
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Modify table of contents with natural language
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Chat Messages Area - Scrollable with Fixed Height */}
            <Box sx={{
              height: 'calc(100vh - 400px)', // Fixed height that accounts for header, input, etc.
              minHeight: '400px',
              maxHeight: '600px',
              overflow: 'auto',
              mb: 2,
              p: 2,
              borderRadius: 2,
              background: '#f9fafb',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                background: '#f1f1f1',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                background: '#888',
                borderRadius: '4px',
                '&:hover': {
                  background: '#555',
                },
              },
            }}>
              {tocChatHistory.length === 0 ? (
                <Box sx={{
                  textAlign: 'center',
                  py: 3,
                  color: '#94a3b8'
                }}>
                  <EditNote sx={{ fontSize: 36, mb: 1, opacity: 0.5 }} />
                  <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                    Start a conversation
                  </Typography>
                  <Typography variant="caption" sx={{ maxWidth: 350, mx: 'auto', display: 'block' }}>
                    Try: "Add security section" or "Rename Overview"
                  </Typography>
                </Box>
              ) : (
                tocChatHistory.map((entry, index) => (
                  <Box key={index}>
                    {/* User Message */}
                    <Box sx={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      mb: 0.5
                    }}>
                      <Paper sx={{
                        px: 2,
                        py: 1,
                        maxWidth: '70%',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        borderRadius: 1.5
                      }}>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>{entry.user_message}</Typography>
                      </Paper>
                    </Box>
                    {/* AI Response */}
                    <Box sx={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      mb: 1
                    }}>
                      <Paper sx={{
                        px: 2,
                        py: 1,
                        maxWidth: '70%',
                        background: 'white',
                        borderRadius: 1.5,
                        border: '1px solid #e2e8f0'
                      }}>
                        {entry.ai_response === '...' ? (
                          <Box display="flex" alignItems="center" gap={1}>
                            <CircularProgress size={16} />
                            <Typography variant="body2" sx={{ fontSize: '0.875rem', color: '#94a3b8' }}>
                              Thinking...
                            </Typography>
                          </Box>
                        ) : (
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.875rem',
                              whiteSpace: 'pre-wrap', // Preserve line breaks and spacing
                              wordBreak: 'break-word' // Prevent long words from breaking layout
                            }}
                          >
                            {entry.ai_response}
                          </Typography>
                        )}
                      </Paper>
                    </Box>
                  </Box>
                ))
              )}

              {/* TOC Preview if exists */}
              {tocPreview && pendingTocOperation && (
                <>
                  {/* Only show Apply/Cancel for actionable operations, not suggestions */}
                  {pendingTocOperation.action !== 'suggest_topics' ? (
                    <Alert
                      severity="info"
                      sx={{ mt: 2 }}
                      action={
                        <Box display="flex" gap={1}>
                          <Button size="small" onClick={confirmTocModification}>Apply</Button>
                          <Button size="small" onClick={() => {
                            setTocPreview(null);
                            setPendingTocOperation(null);
                          }}>Cancel</Button>
                        </Box>
                      }
                    >
                      <Typography variant="body2">
                        {pendingTocOperation.interpretation || 'Preview of changes above. Apply or cancel?'}
                      </Typography>
                    </Alert>
                  ) : (
                    <Alert
                      severity="success"
                      sx={{ mt: 2 }}
                      action={
                        <Button
                          size="small"
                          onClick={() => {
                            setTocPreview(null);
                            setPendingTocOperation(null);
                          }}
                        >
                          Got it
                        </Button>
                      }
                    >
                      <Typography variant="body2" fontWeight={600} gutterBottom>
                        💡 Suggestions (informational only)
                      </Typography>
                      <Typography variant="caption">
                        These are recommendations to improve your TOC. You can implement them by giving specific commands like "add topic X", "remove topic Y", etc.
                      </Typography>
                    </Alert>
                  )}
                </>
              )}

              {/* Scroll anchor */}
              <div ref={tocChatEndRef} />
            </Box>

            {/* Chat Input Area - Compact */}
            <Box sx={{
              display: 'flex',
              gap: 1,
              p: 1.5,
              borderTop: '1px solid #e2e8f0',
              background: 'white'
            }}>
              <TextField
                fullWidth
                multiline
                maxRows={2}
                placeholder="Type a command... e.g., 'Add security section'"
                value={tocChatInput}
                onChange={(e) => setTocChatInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleTocChatMessage(tocChatInput, setTocChatInput, setTocGeneratingTopics, (msg) => {
                      setErrorMessage(msg || '');
                      if (msg) setShowErrorNotification(true);
                    });
                  }
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1.5,
                    '&.Mui-focused fieldset': {
                      borderColor: '#667eea'
                    }
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '0.875rem'
                  }
                }}
              />
              <Button
                variant="contained"
                onClick={() => handleTocChatMessage(tocChatInput, setTocChatInput, setTocGeneratingTopics, (msg) => {
                  setErrorMessage(msg || '');
                  if (msg) setShowErrorNotification(true);
                })}
                disabled={!tocChatInput.trim() || tocGeneratingTopics.has('toc-chat')}
                sx={{
                  minWidth: 48,
                  height: 48,
                  borderRadius: 1.5,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a67d8 0%, #6b5b95 100%)'
                  }
                }}
              >
                {tocGeneratingTopics.has('toc-chat') ? (
                  <CircularProgress size={20} sx={{ color: 'white' }} />
                ) : (
                  <Send sx={{ color: 'white' }} />
                )}
              </Button>
            </Box>
          </Box>
        </Box>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <ContentGenerationPanel
          draft={draft}
          currentToc={currentToc}
          onContentUpdate={setCurrentToc}
          editingTopic={editingTopic}
          centralizedState={centralizedState}
          updateSelectedItem={updateSelectedItem}
          updateConversationHistory={updateConversationHistory}
          updateGeneratedContent={updateGeneratedContent}
          updateCurrentContent={updateCurrentContent}
          markContentAsUnsaved={markContentAsUnsaved}
          markContentAsSaved={markContentAsSaved}
          autoSaving={autoSaving}
          updateGeneratedContentWithAutoSave={updateGeneratedContentWithAutoSave}
          tocChatMode={tocChatMode}
          setTocChatMode={setTocChatMode}
          tocPreview={tocPreview}
          setTocPreview={setTocPreview}
          pendingTocOperation={pendingTocOperation}
          setPendingTocOperation={setPendingTocOperation}
          handleTocChatMessage={handleTocChatMessage}
          confirmTocModification={confirmTocModification}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <ExportReviewPanel draft={draft} currentToc={currentToc} />
      </TabPanel>

      {/* Professional Success Notification */}
      <Snackbar
        open={showSuccessNotification}
        autoHideDuration={4000}
        onClose={() => setShowSuccessNotification(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        TransitionComponent={Fade}
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            padding: 0,
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 3,
            pr: 4,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: 3,
            boxShadow: '0 10px 25px rgba(102, 126, 234, 0.3), 0 4px 12px rgba(102, 126, 234, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            minWidth: 320,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #818cf8 0%, #a78bfa 100%)',
            },
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <CheckCircle sx={{ fontSize: 28, color: 'white' }} />
          </Box>
          <Box flex={1}>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{
                fontSize: '1.1rem',
                mb: 0.5,
                color: 'white',
              }}
            >
              Changes Saved Successfully
            </Typography>
            <Typography
              variant="body2"
              sx={{
                opacity: 0.95,
                fontSize: '0.9rem',
                lineHeight: 1.4,
              }}
            >
              Your table of contents has been updated and saved to the system.
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setShowSuccessNotification(false)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': {
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </Paper>
      </Snackbar>

      {/* Professional Error Notification */}
      <Snackbar
        open={showErrorNotification}
        autoHideDuration={6000}
        onClose={() => setShowErrorNotification(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        TransitionComponent={Fade}
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: 'transparent',
            boxShadow: 'none',
            padding: 0,
          },
        }}
      >
        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 3,
            pr: 4,
            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            color: 'white',
            borderRadius: 3,
            boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3), 0 4px 12px rgba(239, 68, 68, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            minWidth: 320,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '3px',
              background: 'linear-gradient(90deg, #f87171 0%, #fca5a5 100%)',
            },
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Error sx={{ fontSize: 28, color: 'white' }} />
          </Box>
          <Box flex={1}>
            <Typography
              variant="h6"
              fontWeight={700}
              sx={{
                fontSize: '1.1rem',
                mb: 0.5,
                color: 'white',
              }}
            >
              Save Failed
            </Typography>
            <Typography
              variant="body2"
              sx={{
                opacity: 0.95,
                fontSize: '0.9rem',
                lineHeight: 1.4,
              }}
            >
              {errorMessage}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => setShowErrorNotification(false)}
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              color: 'rgba(255, 255, 255, 0.8)',
              '&:hover': {
                color: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)',
              },
            }}
          >
            <Close sx={{ fontSize: 18 }} />
          </IconButton>
        </Paper>
      </Snackbar>
    </Container>
  );
};

export default DraftEditPage;