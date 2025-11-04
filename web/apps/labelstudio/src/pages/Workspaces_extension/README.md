# Workspaces Frontend Extension

## Overview

This folder contains the complete frontend implementation for workspace-based access control in Label Studio.

**Purpose:** Allow admins to group projects into workspaces and manage user access at the workspace level instead of per-project.

---

## Files in This Folder

### Components (4 files)

1. **`WorkspacesPage.jsx`** - Main list page
   - Shows all workspaces user can access
   - Create workspace button
   - Entry point for the workspace feature

2. **`WorkspacesList.jsx`** - List display component
   - Renders workspace cards
   - Delete functionality
   - Navigation to detail pages

3. **`WorkspaceDetail.jsx`** - Detail page
   - Shows single workspace info
   - Tabs for projects and members
   - Remove projects/members

4. **`CreateWorkspaceModal.jsx`** - Create form
   - Modal with form for new workspace
   - Title and description inputs

### Styles (2 files)

5. **`WorkspacesPage.scss`** - List page styles
6. **`WorkspaceDetail.scss`** - Detail page styles

### Configuration (1 file)

7. **`index.js`** - Export point

### Documentation (1 file)

8. **`FRONTEND_INTEGRATION.md`** - Integration instructions

---

## Integration Required

**This folder is self-contained** but requires minimal changes to integrate:

### Changes Made (Already Applied ✅)

1. **API Endpoints** - Added to `src/config/ApiConfig.js`
2. **Page Registration** - Added to `src/pages/index.js`
3. **Navigation Menu** - Added to `src/components/Menubar/Menubar.jsx`
4. **Sub-routing** - Added to `WorkspacesPage.jsx`

**See `FRONTEND_INTEGRATION.md` for details.**

---

## How It Works

### Route Structure

```
/workspaces           → WorkspacesPage (list all workspaces)
/workspaces/:id       → WorkspaceDetail (show specific workspace)
```

### Data Flow

```
User clicks "Workspaces" in menu
    ↓
WorkspacesPage component renders
    ↓
Calls API: callApi("workspaces", {})
    ↓
Backend: GET /api/workspaces/
    ↓
Returns JSON array of workspaces
    ↓
WorkspacesList renders the data
```

---

## API Methods Used

All defined in `src/config/ApiConfig.js`:

- `workspaces` - GET /workspaces/
- `workspaceDetail` - GET /workspaces/:pk/
- `createWorkspace` - POST /workspaces/
- `deleteWorkspace` - DELETE /workspaces/:pk/
- `workspaceRemoveProject` - POST /workspaces/:pk/remove-project/
- `workspaceRemoveMember` - POST /workspaces/:pk/remove-member/

---

## Patterns Used

All patterns match existing Label Studio code:

| Pattern | Example File | Usage |
|---------|--------------|-------|
| `useContext(ApiContext)` | Projects.jsx | API calls |
| `Block/Elem` BEM utils | All pages | CSS styling |
| `Button` from @humansignal/ui | All components | Buttons |
| `modal()` utility | PeoplePage | Modals |
| `Page.title/path/exact` | Projects.jsx | Routing |
| `useState/useEffect` | All pages | State |

**No new patterns introduced** - uses only existing Label Studio conventions.

---

## Dependencies

**Zero new dependencies!**

Uses only existing Label Studio libraries:
- React (already installed)
- react-router-dom (already installed)
- @humansignal/ui (already installed)
- @humansignal/icons (already installed)

---

## Testing

### Development Mode

```bash
cd web/apps/labelstudio
npm run dev
```

Navigate to `http://localhost:8080/workspaces`

### Production Build

```bash
npm run build
```

### Verification

1. No console errors when visiting /workspaces
2. "Workspaces" appears in navigation
3. Can click and navigate
4. Can create workspace
5. Can view detail page

---

## Troubleshooting

### "Workspaces" doesn't appear in menu

**Check:** Is menu item added to Menubar.jsx line 225?

### Page shows 404

**Check:** Is WorkspacesPage added to Pages array in index.js?

### "workspaces is not a function" error

**Check:** Are API endpoints added to ApiConfig.js?

### Build errors

**Check:** All import paths are correct (no typos)

---

## Minimal Code Philosophy

This implementation follows **"as little code as possible"** principle:

- ❌ No complex state management (no Redux/MobX)
- ❌ No extra dependencies
- ❌ No advanced features (search, pagination, etc.)
- ❌ No over-engineering

**Only essential functionality to prove the concept works.**

Additional features can be added incrementally later.

---

## Code Quality

- ✅ ESLint compatible
- ✅ PropTypes optional (TypeScript not required)
- ✅ Commented for clarity
- ✅ Error handling on all API calls
- ✅ Loading states
- ✅ Empty states
- ✅ User confirmations

---

## Maintenance

### Adding Features

To add features later (like add member UI):

1. Create new component in this folder
2. Import in WorkspaceDetail.jsx
3. Add to UI
4. No external changes needed!

### Removing Feature

To disable workspaces:

1. Remove 3 lines from external files
2. Keep this folder (can re-enable later)

---

## License

Same as Label Studio (Apache 2.0)

---

## Questions?

See `FRONTEND_INTEGRATION.md` for detailed integration instructions.
