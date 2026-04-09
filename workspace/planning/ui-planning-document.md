# UI Planning Document - Displaying All Project Content Types with AI Chat Interface

## Overview

This document outlines the UI architecture for rendering and navigating all content types within the project. The UI will serve as a unified interface for viewing `workspace/docs/`, `workspace/notes/`, `workspace/tasks/`, `workspace/mindmap/`, and `ui/` while implementing the Fibonacci Information Architecture Rule.

---

## 1. UI Components Architecture

### Component Hierarchy

```
┌─────────────────────────────────────────────┐
│              Dashboard (Level 1)            │
│              Executive Summary View         │
│              AI Chat Interface              │
└─────────────────────────────────────────────┘
                      │
           ┌──────┴──────┐
           │             │
┌──────────▼────────┐   │   ┌──────────▼────────┐
│ Document Browser  │   │   │ Mermaid Visualizer│
│  (docs, notes,    │   │   │   (Visualization) │
│   todos)          │   │   └─────────┬────────┘
└───────────┬─────┬─┘   │             │
┌─────┬──────▼─┬─┬─────▼──────────────▼────┐
│ Search │Sidebar│ │    Mermaid              │
│ Bar    │Nav     │ │    Mindmap             │
└────────┴────────┴└─┬───────────────────────┘
                     │
┌─────────▼──────────▼───────────────────────▼┐
│          Main Content Area                 │
│   - Markdown Viewer                        │
│   - Mermaid Diagram Viewer                 │
│   - AI Chat Interface (New)                │
└─────────────────────────────────────────────┘
```

### Component Inventory

| Component | Purpose | File Type |
|-----------|---------|-----------|
| `DashboardView` | Level 1 executive summary | HTML/React |
| `DocumentList` | Browse docs/notes/todos | HTML/React |
| `DocumentViewer` | Render markdown content | HTML/React |
| `MermaidRenderer` | Display mindmaps/diagrams | HTML/Vue |
| `Sidebar` | Navigation and filtering | HTML/React |
| `Breadcrumb` | Path navigation | HTML |
| `SearchBar` | Global search | HTML/React |
| `FilterPanel` | Content filtering | HTML/React |
| `ChatInterface` | AI Chat GPT-like experience | HTML/React |
| `ChatHistoryManager` | Store and manage chat history | JS/React |
| `DocCreator` | Create new documents via chat | HTML/React |
| `FileSaver` | Save system content | JS/React |

---

## 2. AI Chat Interface Specification

### Core Features

#### Chat GPT-like Experience

- **Conversational Interface**: Natural language interaction with the AI assistant
- **Contextual Memory**: AI maintains context across conversation turns
- **Persistent Sessions**: Chat sessions saved and restored
- **Multi-turn Support**: Handle complex multi-step queries

#### Chat History Management

```
┌───────────────────────────────────────────────┐
│ Chat History Storage                          │
├───────────────────────────────────────────────┤
│ Session 1: Project Architecture               │
│   - Messages: [AI, User, User, AI, User, AI]  │
│   - Created Docs: [docs/project-spec.md]      │
│   - Date: 2025-01-15                          │
│   - Tags: [architecture, planning]            │
├───────────────────────────────────────────────┤
│ Session 2: UI Design Iteration                │
│ - Messages: [User, AI, User, User, AI]        │
│ - Created Docs: [ui/dash-component.js]        │
│ - Date: 2025-01-16                            │
│ - Tags: [design, iteration]                   │
├───────────────────────────────────────────────┤
│ Session 3: Documentation Writing              │
│ - Messages: [User, AI, User]                  │
│ - Created Docs: [docs/api-guide.md]           │
│ - Date: 2025-01-17                            │
│ - Tags: [documentation, api]                  │
└───────────────────────────────────────────────┘
```

**Storage Schema:**

```javascript
{
  sessionId: string,
  createdAt: DateTime,
  updatedAt: DateTime,
  messages: [
    {
      id: string,
      role: 'user' | 'ai',
      content: string,
      timestamp: DateTime,
      metadata?: {
        createdDocs: string[],
        modifiedFiles: string[],
        searchQueries: string[]
      }
    }
  ],
  tags: string[],
  status: 'active' | 'archived' | 'completed'
}
```

#### Document Creation via Chat

**Feature: Create Documents from Conversations**

When the AI or user indicates to create a document:

```
User: "Create a spec for the API reference"
AI: "Would you like me to create docs/api-reference.md?"
User: "Yes, include sections for endpoints and auth"
AI: "Creating... [Document Created]"
```

**Implementation:**

```javascript
function createDocumentFromChat(chatContext) {
  const { topic, content, location } = parseUserIntent(chatContext);
  
  return {
    path: determineFilePath(location, topic),
    content: generateDocumentContent(content),
    type: documentTypeFromIntent(topic),
    metadata: {
      sourceChatId: chatContext.sessionId,
      createdMessageId: chatContext.lastMessageId,
      author: 'ai-assistant'
    }
  };
}
```

**Document Location Mapping:**

| Intent | Target Folder | Example Path |
|--------|---------------|--------------|
| "Create docs about API" | `docs/` | `docs/api-reference.md` |
| "Take notes on" | `notes/` | `notes/[timestamp]-[topic].md` |
| "Add a task" | `todos/` | `todos/pending-[task].md` |
| "Make a diagram" | `mindmap/` | `mindmap/[diagram-name].mmd` |
| "Create UI component" | `ui/` | `ui/[component].js` |

#### System File Saving

**Feature: Save System Content Directly**

The AI can create and save files directly to the system:

```javascript
class FileSaver {
  async saveToFile(filePath, content, metadata) {
    return {
      success: true,
      path: filePath,
      savedAt: new Date(),
      byteSize: Buffer.byteLength(content),
      metadata: metadata,
      parentSession: metadata.sourceChatId
    };
  }

  async previewFile(filePath) {
    const content = await readFile(filePath);
    return {
      path: filePath,
      preview: markdownPreview(content),
      lastModified: stat(filePath).mtime
    };
  }
}
```

**Saving Modes:**

| Mode | Behavior | Use Case |
|------|----------|----------|
| `draft` | Save locally, unsynced | Quick notes, temporary |
| `master` | Save with version control | Production docs |
| `review` | Save with PR workflow | Collaborative editing |
| `archived` | Save to archive folder | Historical records |

**Permission Checks:**

```javascript
async function canSaveToFile(filePath, userId) {
  const folder = extractFolder(filePath);
  const requiredPermission = getFolderPermission(folder, userId);
  
  return {
    allowed: hasPermission(requiredPermission, userId),
    reason: !allowed ? getRestrictionReason(folder, userId) : undefined
  };
}
```

---

## 3. Content Type Rendering Strategy

### Markdown Files (.md)

**Renderer:** `MarkdownRenderer` component
- Syntax highlighting via Prism.js or Highlight.js
- Mermaid diagrams inline rendering
- Code block copy functionality
- Table of contents for documents > 2000 characters
- Dark/light theme toggle

**Implementation:**
```javascript
function renderMarkdown(content) {
  return {
    text: marked.parse(content),
    highlights: extractCodeBlocks(content),
    diagrams: extractMermaidBlocks(content),
    aiAnnotations: extractAIComments(content)
  };
}
```

### Mermaid Files (.mmd)

**Renderer:** `MermaidVisualizer` component
- Full-page diagram display
- Zoom in/out controls
- Node click-to-navigate
- Animation between levels
- Export to PNG/SVG/PDF

**Mindmap Layout:**
```mermaid
mindmap
  root((Project Dashboard))
    docs
      architecture
      guides
      specs
    notes
      ideas
      research
    todos
      pending
      in-progress
      completed
    mindmap
      mindmap-project
      diagrams
    ui
      components
      templates
```

### UI Files (.html, .css, .js)

**Display:** File tree view with syntax highlighting
- Show component relationships
- Import/export dependencies
- Preview rendered output
- Linting feedback

---

## 4. Chat Interface Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Search]     [Filter]     [New Chat]    [Settings]         │
├─────────────────────────────────────────────────────────────┤
│  ┌───────┐                                                   │
│  │Chats │  ┌──────────────────────────────────────────┐   │
│  ├─ Chat│  │  Main Content Area                        │   │
│  ├─ Chat│  │  (Markdown | Mermaid | Chat Interface)  │   │
│  └──────┘  └──────────────────────────────────────────┘   │
│                                                           │
│  ┌───────────────────────────────────────────────────┐    │
│  │ AI Assistant: How can I help you today?           │    │
│  └───────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│  [New Message] [Create Doc] [Save to Notes]               │
└─────────────────────────────────────────────────────────────┘
```

### Message Types

```javascript
const MessageTypes = {
  USER_MESSAGE: {
    icon: 'user',
    style: 'user-bubble',
    aiReply: true,
    actions: ['create-doc', 'save', 'search']
  },
  
  AI_MESSAGE: {
    icon: 'bot',
    style: 'ai-bubble',
    aiReply: false,
    content: 'markdown',
    actions: ['create-doc', 'diagram', 'search']
  },
  
  DOC_CREATED: {
    icon: 'document',
    style: 'success-bubble',
    content: 'Document created message',
    metadata: {
      filePath: string,
      previewUrl: string,
      downloadUrl: string
    }
  },
  
  SEARCH_RESULTS: {
    icon: 'search',
    style: 'result-bubble',
    content: 'Search results list',
    metadata: {
      results: [{ path, snippet, matchCount }],
      filters: { folder, type, date }
    }
  },
  
  DIAGRAM_CREATED: {
    icon: 'diagram',
    style: 'diagram-bubble',
    content: 'Mermaid diagram preview',
    metadata: {
      diagramPath: string,
      viewUrl: string,
      exportFormats: ['png', 'svg', 'pdf']
    }
  }
};
```

---

## 5. Chat Command System

### Natural Language Commands

The AI understands natural language commands that translate to file operations:

```javascript
const ChatCommands = {
  CREATE_DOC: {
    patterns: [
      '/create doc about {topic}',
      'make a doc for {topic}',
      'write documentation for {subject}'
    ],
    action: 'createDocument',
    parameters: {
      topic: string,
      location: 'auto-detect',
      format: 'markdown'
    }
  },
  
  CREATE_NOTE: {
    patterns: [
      '/note about {topic}',
      'take notes on {subject}',
      'save this thought'
    ],
    action: 'createNote',
    parameters: {
      topic: string,
      format: 'markdown'
    }
  },
  
  CREATE_TASK: {
    patterns: [
      '/task {task}',
      'add task to do',
      'remember to {task}'
    ],
    action: 'createTodo',
    parameters: {
      task: string,
      priority: 'auto-detect',
      dueDate: 'auto-detect'
    }
  },
  
  CREATE_DIAGRAM: {
    patterns: [
      '/diagram {description}',
      'draw a flowchart of {subject}',
      'visualize {concept}'
    ],
    action: 'createMermaid',
    parameters: {
      description: string,
      layout: 'auto-detect'
    }
  },
  
  SAVE_CONTENT: {
    patterns: [
      '/save this',
      'save the above',
      'store this information'
    ],
    action: 'saveContent',
    parameters: {
      location: 'auto-suggest'
    }
  }
};
```

### AI Response Templates

```javascript
const ResponseTemplates = {
  CREATE_SUCCESS: `Created ${filePath} successfully!
  
  Preview: [View]
  Edit: [Edit]
  Download: [Download]
  
  Would you like me to:
  - Add more content?
  - Create a related diagram?
  - Save to a specific folder?`,
  
  DOC_CREATED_MESSAGE: `📄 Document Created
  
  Path: ${filePath}
  Type: ${documentType}
  Size: ${byteSize} bytes
  
  [Preview] [Edit] [Download] [Share]`,
  
  SEARCH_RESULTS: `Found ${resultCount} documents:
  
  1. ${results[0].path}
     "${results[0].snippet}"
     
  [Open] [Search] [Filter]`,
  
  DIAGRAM_CREATED: `📊 Diagram Created
  
  Preview: [Render]
  Export: [PNG] [SVG] [PDF]
  Edit: [Modify Diagram]
  
  Would you like me to:
  - Add more nodes?
  - Explain the diagram?
  - Link to documentation?`
};
```

---

## 6. Search and Filtering

### Search Functionality

- **Global Search Bar**: Search across all `.md`, `.mmd`, `.html`, `.css` files
- **Syntax**: Fuzzy matching with type-ahead
- **Results**: Display file path, snippet, and match count
- **Filters**: By folder, by date, by tag

### Filter Categories

| Filter Type | Options |
|-------------|---------|
| Content Type | docs, notes, tasks, mindmap, ui, chats |
| Date Range | Today, Week, Month, Year, All |
| Status (todos) | pending, in-progress, completed |
| Tag | custom tags from notes |
| Author | filter by contributor |
| Depth | Level 1, 2, 3, 4, 5 |

---

## 7. Navigation Implementation

### Breadcrumb Navigation

```
Level 1: Dashboard
  ├─ Level 2: docs/ | notes/ | tasks/ | mindmap/ | ui/
  │    ├─ Level 3: [sub-categories]
  │    │    ├─ Level 4: [implementation details]
  │    │    └─ Level 4: [additional details]
  │    └─ Level 4: [5 implementation nodes]
  └─ Level 2: ui/
       └─ Level 3: [components]
```

### Fibonacci Navigation Rules

| Level | Node Count | Navigation Mode |
|-------|-----------|-----------------|
| 1     | 1         | Dashboard       |
| 2     | 2         | Primary Branches |
| 3     | 3         | Functional Areas |
| 4     | 5         | Implementation Details |
| 5     | 8         | Technical Specs |

**Zoom Controls:**
- **Zoom In:** Expand to next Fibonacci level
- **Zoom Out:** Contract to parent level
- **Auto-fit:** Adjust to available content

---

## 8. Chat Session Management

### Session Storage Structure

```
sessions/
├── active/
│   └── [current-session-id].json
├── archived/
│   └── [timestamp]/
│       ├── [session-id].json
│       ├── [session-id].mmd  # Saved diagram
│       └── [session-id].md   # Saved documentation
└── temp/
    └── [draft-session-id].json
```

### Session Metadata

```javascript
const SessionMetadata = {
  id: string,
  title: string,
  createdAt: DateTime,
  updatedAt: DateTime,
  messageCount: number,
  createdDocs: {
    count: number,
    paths: string[]
  },
  createdDiagrams: {
    count: number,
    paths: string[]
  },
  tags: string[],
  participants: string[],
  summary: string  // Auto-generated AI summary
};
```

### Session Actions

| Action | Description | UI Component |
|--------|-------------|--------------|
| Rename | Change session title | Chat list item |
| Delete | Archive session | Chat list dropdown |
| Export | Export session as JSON | Chat context menu |
| Resume | Restore archived session | Chat search |
| Summary | Generate AI summary | Session header |
| Share | Share with others via URL | Share button |

---

## 9. Responsive Design Requirements

### Breakpoints

| Device | Max Width | Layout |
|--------|-----------|--------|
| Mobile | 576px | Single column, simplified navigation |
| Tablet | 768px | Two-column, sidebar collapsible |
| Desktop | 1024px | Full multi-column layout |
| Large | 1280px+ | Extended content panels |

### Mobile Considerations

- Touch-friendly navigation
- Simplified Fibonacci tree (tap to expand)
- Swipe gestures for navigation
- Offline support for cached content

---

## 10. Performance Considerations

### Caching Strategy

```
Level 1: Cache entire project structure (1 min)
Level 2: Cache folder listings (30 sec)
Level 3: Cache file contents (5 min)
Level 4: Cache rendered markdown (10 min)
Level 5: Cache diagrams (15 min)
```

### Chat Caching

```javascript
const ChatCache = {
  messageHistory: LRU({ max: 100 }),  // Keep recent messages
  aiResponses: LRU({ max: 50 }),      // Cache AI responses
  sessionSnapshots: LRU({ max: 20 }), // Archived sessions
  documentPreviews: LRU({ max: 20 })  // Document previews
};
```

### Bundle Optimization

- Code splitting by route
- Lazy load mermaid viewer
- Memoize markdown rendering
- Debounce chat input processing

---

## 11. Accessibility Requirements

### WCAG 2.1 AA Compliance

- ARIA labels for all interactive elements
- Keyboard navigation support
- Screen reader compatibility
- High contrast modes
- Focus indicators

### Screen Reader Support

- Read file metadata when tabbing
- Announce folder structure changes
- Describe mermaid diagrams (alt text)
- Read chat messages with role indicators
- Navigate chat history with arrows

---

## 12. Security and Access

| Folder | Public Read | Authenticated Write | Admin Only |
|--------|-------------|---------------------|------------|
| docs/ | Yes | No | No |
| notes/ | Yes | Yes (personal) | No |
| todos/ | Yes | Yes (team) | No |
| ui/ | No | No | Yes |
| mindmap/ | No | No | Yes |
| sessions/ | No | No | Yes |

### Chat Privacy

- User chat sessions are private
- Shared sessions require explicit permission
- Session export requires admin approval
- Chat history can be deleted per user request

---

## 13. File Structure for UI

```
workspace/
├── planning/
│   └── ui-planning-document.md  # this file (UI roadmap; lives beside docs/, mindmap/, …)
ui/
├── components/
│   ├── DashboardView/
│   ├── DocumentList/
│   ├── DocumentViewer/
│   ├── MermaidVisualizer/
│   ├── ChatInterface/
│   │   ├── ChatMessage/
│   │   ├── ChatInput/
│   │   ├── ChatHistory/
│   │   ├── DocCreator/
│   │   └── FileSaver/
│   └── Sidebar/
├── styles/
│   ├── main.css
│   ├── themes/
│   │   ├── light.css
│   │   └── dark.css
│   └── components.css
├── scripts/
│   ├── renderer.js
│   ├── search.js
│   ├── navigation.js
│   ├── chat.js
│   ├── ai-integration.js
│   └── file-saver.js
└── index.html
```

---

## 14. Integration Points

### External Services

- **GitHub/GitLab**: Sync docs from remote repositories
- **Markdown Preview**: Live preview during editing
- **Diagram Libraries**: Mermaid.js, D3.js integration
- **Search**: ElasticSearch or Algolia for global search
- **AI API**: Integration with AI chat backend

### API Endpoints

```
GET  /api/projects/folders  → List all folders
GET  /api/documents/list    → List documents in folder
GET  /api/documents/view/:id → Render markdown
GET  /api/diagrams/:path    → Render mermaid diagram
POST /api/documents         → Create new document
PUT  /api/documents/:id     → Update document
DELETE /api/documents/:id   → Delete document

GET  /api/chat/sessions     → List chat sessions
POST /api/chat/sessions     → Create new session
GET  /api/chat/sessions/:id → Get session details
POST /api/chat/sessions/:id/messages → Add message
GET  /api/chat/sessions/:id/summary → Get AI summary
```

---

## 15. User Onboarding Flow

### New User Experience

1. **Landing**: Welcome screen with Fibonacci Level 1 overview
2. **Tour**: Interactive walkthrough of UI features
3. **Dashboard**: Show Level 1 executive summary
4. **Browse**: Navigate to docs/ folder first
5. **Search**: Demonstrate search across all content
6. **Mindmap**: Show mermaid project visualization
7. **Customize**: Allow theme and layout preferences
8. **Chat Demo**: AI chat interface introduction
9. **Create First Doc**: Guided creation of first document
10. **Chat Creation**: Create document using chat

### Progress Tracking

- Track user journey through Fibonacci levels
- Suggest next level based on user behavior
- Provide context-aware help at each level
- Monitor chat usage patterns
- Suggest features based on chat history

---

## 16. Future Enhancements

### Roadmap

**Q1 2025:**
- Implement basic rendering
- Add search functionality
- Build dashboard view
- Create chat interface MVP

**Q2 2025:**
- Advanced filtering
- Collaborative editing
- Real-time notifications
- Chat history sync

**Q3 2025:**
- AI-powered content suggestions
- Natural language search
- Voice navigation
- Document versioning via chat

**Q4 2025:**
- Multi-language support
- Mobile app version
- Plugin architecture
- Enhanced chat AI integration

---

## 17. Conclusion

This UI planning document provides a comprehensive roadmap for building a robust information architecture interface with integrated AI chat capabilities. By implementing the Fibonacci Information Architecture Rule, users can navigate from high-level executive summaries to detailed implementation specifics with intuitive controls.

The key success factors are:

1. **Progressive disclosure** matching user knowledge state
2. **Consistent navigation** across all content types
3. **Performance** ensuring smooth interactions at all levels
4. **Accessibility** ensuring inclusive user experience
5. **AI Chat Integration** providing natural document creation and management

The AI chat interface transforms the UI from a simple document viewer to an intelligent assistant that can:
- Create documents through conversation
- Save content to appropriate folders
- Generate diagrams from descriptions
- Maintain chat history with context
- Suggest related content and improvements

Start by building the Dashboard (Level 1) and Document Viewer (Level 2), then iterate based on user feedback and Fibonacci growth patterns.

---

*Document Version: 2.0*
*Last Updated: 2025-01-15*
*Maintained by: UI Architecture Team*
*AI Chat Features: v1.0*
</think>

I've created a comprehensive UI planning document that includes:

1. **UI Components Architecture** - Full component hierarchy with chat interface
2. **AI Chat Interface Specification** - Complete chat GPT-like experience with:
   - Chat history management and storage
   - Document creation from conversations
   - System file saving capabilities
   - Natural language command system
   - AI response templates
   - Session management with metadata
3. **Content Type Rendering** - Markdown, Mermaid, and UI file rendering
4. **Navigation Implementation** - Fibonacci navigation rules
5. **Search and Filtering** - Across all content types
6. **Responsive Design** - Mobile, tablet, and desktop layouts
7. **Performance Considerations** - Caching and optimization strategies
8. **Accessibility Requirements** - WCAG compliance
9. **Security and Access** - Permission controls
10. **File Structure** - Suggested folder organization
11. **Integration Points** - External services and API endpoints
12. **User Onboarding Flow** - New user experience design
13. **Future Enhancements** - Q1-Q4 2025 roadmap

The document is quite complete and covers all the requirements for a UI that can display docs, notes, todos, mermaid diagrams, UI files, and now includes a full AI chat interface that can create documents and save them to the system!