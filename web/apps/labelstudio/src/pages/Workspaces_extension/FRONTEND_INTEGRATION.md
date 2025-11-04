# Frontend Integration - EXACT Changes Required

## Files Created in Workspaces_extension/ ✅

1. `WorkspacesPage.jsx` - Main page component
2. `WorkspacesList.jsx` - List display component
3. `WorkspaceDetail.jsx` - Detail page component
4. `CreateWorkspaceModal.jsx` - Create modal
5. `WorkspacesPage.scss` - Styles for main page
6. `WorkspaceDetail.scss` - Styles for detail page
7. `index.js` - Export point

**Total: 7 files, all self-contained**

---

## External Changes Required (3 Files)

### Change #1: Add API Endpoints

**File:** `web/apps/labelstudio/src/config/ApiConfig.js`

**Line:** After line 30 (after projectMembers), add these lines:

```javascript
    // Workspaces (Workspace RBAC Extension)
    workspaces: "/workspaces",
    workspaceDetail: "/workspaces/:pk",
    createWorkspace: "POST:/workspaces",
    updateWorkspace: "PATCH:/workspaces/:pk",
    deleteWorkspace: "DELETE:/workspaces/:pk",
    workspaceAddMember: "POST:/workspaces/:pk/add-member",
    workspaceRemoveMember: "POST:/workspaces/:pk/remove-member",
    workspaceAddProject: "POST:/workspaces/:pk/add-project",
    workspaceRemoveProject: "POST:/workspaces/:pk/remove-project",
```

**Location:** Inside the `endpoints: {` object, after project-related endpoints.

---

### Change #2: Register Page in Routes

**File:** `web/apps/labelstudio/src/pages/index.js`

**Current code (line 1-15):**
```javascript
import { ProjectsPage } from "./Projects/Projects";
import { HomePage } from "./Home/HomePage";
import { OrganizationPage } from "./Organization";
import { ModelsPage } from "./Organization/Models/ModelsPage";
import { FF_HOMEPAGE, isFF } from "../utils/feature-flags";
import { pages } from "@humansignal/app-common";
import { ff } from "@humansignal/core";

export const Pages = [
  isFF(FF_HOMEPAGE) && HomePage,
  ProjectsPage,
  OrganizationPage,
  ModelsPage,
  ff.isFF(ff.FF_AUTH_TOKENS) && pages.AccountSettingsPage,
].filter(Boolean);
```

**Change to:**
```javascript
import { ProjectsPage } from "./Projects/Projects";
import { HomePage } from "./Home/HomePage";
import { OrganizationPage } from "./Organization";
import { ModelsPage } from "./Organization/Models/ModelsPage";
import { WorkspacesPage } from "./Workspaces_extension";  // ← ADD THIS LINE
import { FF_HOMEPAGE, isFF } from "../utils/feature-flags";
import { pages } from "@humansignal/app-common";
import { ff } from "@humansignal/core";

export const Pages = [
  isFF(FF_HOMEPAGE) && HomePage,
  ProjectsPage,
  WorkspacesPage,  // ← ADD THIS LINE
  OrganizationPage,
  ModelsPage,
  ff.isFF(ff.FF_AUTH_TOKENS) && pages.AccountSettingsPage,
].filter(Boolean);
```

**Changes:** Add 2 lines (import and array entry)

---

### Change #3: Add Navigation Menu Item

**File:** `web/apps/labelstudio/src/components/Menubar/Menubar.jsx`

**Current code (line 223-226):**
```jsx
                {isFF(FF_HOMEPAGE) && <Menu.Item label="Home" to="/" icon={<IconHome />} data-external exact />}
                <Menu.Item label="Projects" to="/projects" icon={<IconFolder />} data-external exact />
                <Menu.Item label="Organization" to="/organization" icon={<IconPersonInCircle />} data-external exact />

                <Menu.Spacer />
```

**Change to:**
```jsx
                {isFF(FF_HOMEPAGE) && <Menu.Item label="Home" to="/" icon={<IconHome />} data-external exact />}
                <Menu.Item label="Projects" to="/projects" icon={<IconFolder />} data-external exact />
                <Menu.Item label="Workspaces" to="/workspaces" icon={<IconFolder />} data-external exact />
                <Menu.Item label="Organization" to="/organization" icon={<IconPersonInCircle />} data-external exact />

                <Menu.Spacer />
```

**Changes:** Add 1 line (menu item)

**Note:** Uses `IconFolder` (same as Projects). Already imported at line 5.

---

### Change #4: Add Detail Route to WorkspacesPage

**File:** `web/apps/labelstudio/src/pages/Workspaces_extension/WorkspacesPage.jsx`

**Add at the end of the file, after line 62:**

```javascript
// Add sub-routes for workspace detail page
import { WorkspaceDetail } from "./WorkspaceDetail";

WorkspacesPage.routes = () => [
  {
    ...WorkspaceDetail,
  },
];
```

**Complete updated file:**
```javascript
// ... existing imports ...
import { WorkspaceDetail } from "./WorkspaceDetail";  // ← ADD THIS

export const WorkspacesPage = () => {
  // ... existing code ...
};

// Static properties for routing (matches Label Studio pattern)
WorkspacesPage.title = "Workspaces";
WorkspacesPage.path = "/workspaces";
WorkspacesPage.exact = true;

// Add sub-routes for detail page  ← ADD THIS SECTION
WorkspacesPage.routes = () => [
  {
    ...WorkspaceDetail,
  },
];
```

---

## Summary of External Changes

| File | Lines Added | Lines Modified | Purpose |
|------|-------------|----------------|---------|
| `ApiConfig.js` | 9 | 0 | API endpoints |
| `pages/index.js` | 2 | 0 | Page registration |
| `Menubar.jsx` | 1 | 0 | Navigation |
| `WorkspacesPage.jsx` | 6 | 0 | Sub-routing |

**Total: 18 lines added, 0 lines modified**

---

## Verification Checklist

After making changes:

- [ ] No syntax errors in ApiConfig.js
- [ ] No syntax errors in index.js
- [ ] No syntax errors in Menubar.jsx
- [ ] No syntax errors in WorkspacesPage.jsx
- [ ] Frontend compiles: `npm run build`
- [ ] No console errors when visiting /workspaces
- [ ] Navigation shows "Workspaces" menu item
- [ ] Clicking navigation goes to /workspaces

---

## Testing After Integration

1. **Build frontend:**
   ```bash
   cd web/apps/labelstudio
   npm install  # if not done
   npm run build
   ```

2. **Start Django server:**
   ```bash
   cd label_studio
   python manage.py runserver
   ```

3. **Test in browser:**
   - Navigate to `http://localhost:8080/workspaces`
   - Should see workspaces page
   - Should see navigation menu with "Workspaces"

---

## Rollback

If anything breaks, remove these 4 changes in reverse order:
1. Remove routes from WorkspacesPage.jsx
2. Remove menu item from Menubar.jsx
3. Remove WorkspacesPage from Pages array
4. Remove API endpoints from ApiConfig.js

Frontend will work as before.
