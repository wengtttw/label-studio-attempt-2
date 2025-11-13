/**
 * WorkspacesList renders the grid view of workspace cards on the main workspaces page.
 * Each card displays workspace metadata and provides actions for navigation and deletion.
 *
 * Dependencies:
 * - ApiContext provides callApi for deleting workspaces via "deleteWorkspace" endpoint
 * - react-router's useHistory enables programmatic navigation to detail view
 * - BEM utilities (Block, Elem) structure the component with workspace-list namespace
 * - Button component from @humansignal/ui for consistent action styling
 *
 * Parent component:
 * - WorkspacesPage passes workspaces array and onUpdate callback
 * - onUpdate triggered after successful delete to refresh the parent's workspace list
 *
 * State management:
 * - Stateless presentation component, all data flows in via props
 * - Uses native confirm dialog for delete confirmation
 * - History.push navigates to /workspaces/:id when card clicked
 *
 * Key responsibilities:
 * - Display workspace cards with title, description, and stats (project/member counts)
 * - Handle click-to-navigate behavior on card body
 * - Confirm and execute workspace deletion via API
 * - Show empty state when no workspaces exist
 */
import React, { useContext } from "react";
import { Button } from "@humansignal/ui";
import { ApiContext } from "../../providers/ApiProvider";
import { useCurrentUser } from "../../providers/CurrentUser";
import { ToastType, useToast } from "@humansignal/ui";
import { Block, Elem } from "../../utils/bem";
import { useHistory } from "react-router-dom";

export const WorkspacesList = ({ workspaces, onUpdate }) => {
  const api = useContext(ApiContext);
  const history = useHistory();
  const { user: currentUser } = useCurrentUser();
  const toast = useToast();
  const isUserLoaded = currentUser && typeof currentUser.org_role === "string";
  const canManageWorkspaces = isUserLoaded && ["admin", "owner"].includes(currentUser.org_role);

  /**
   * Deletes a workspace after user confirmation.
   * Shows native browser confirm dialog, calls deleteWorkspace API endpoint with workspace ID,
   * then triggers parent onUpdate to refresh the list.
   */
  const handleDelete = async (workspaceId) => {
    if (isUserLoaded && !canManageWorkspaces) {
      toast?.show({ type: ToastType.error, title: "Only organization admins and owners can delete workspaces." });
      return;
    }

    if (!window.confirm("Are you sure you want to delete this workspace?")) {
      return;
    }

    try {
      await api.callApi("deleteWorkspace", {
        params: { pk: workspaceId },
      });
      onUpdate();
    } catch (error) {
      console.error("Failed to delete workspace:", error);
    }
  };

  /**
   * Navigates to the workspace detail page when a card is clicked.
   * Uses react-router history.push to transition to /workspaces/:id route.
   */
  const handleNavigate = (workspaceId) => {
    history.push(`/workspaces/${workspaceId}`);
  };

  if (!workspaces || workspaces.length === 0) {
    return (
      <Block name="empty-workspaces">
        <Elem name="message">
          <p>No workspaces yet. Create your first workspace to organize projects.</p>
        </Elem>
      </Block>
    );
  }

  return (
    <Block name="workspaces-list">
      {workspaces.map((workspace) => (
        <Elem name="item" key={workspace.id}>
          <Elem name="info" onClick={() => handleNavigate(workspace.id)}>
            <Elem name="title">{workspace.title}</Elem>
            <Elem name="description">{workspace.description}</Elem>
            <Elem name="stats">
              Projects: {workspace.project_count || 0} | Members: {workspace.member_count || 0}
            </Elem>
          </Elem>
          <Elem name="actions">
            <Button size="small" danger onClick={() => handleDelete(workspace.id)} disabled={isUserLoaded && !canManageWorkspaces}>
              Delete
            </Button>
          </Elem>
        </Elem>
      ))}
    </Block>
  );
};