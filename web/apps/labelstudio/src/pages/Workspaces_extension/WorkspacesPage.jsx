/**
 * WorkspacesPage serves as the primary container and router for the workspace management feature.
 * This component acts as the landing page at /workspaces and coordinates between list and detail views.
 *
 * Dependencies:
 * - ApiContext provides callApi method for HTTP requests to workspace endpoints
 * - react-router's useLocation tracks current path to trigger data fetching
 * - WorkspacesList child component displays the grid of workspace cards
 * - CreateWorkspaceModal handles workspace creation via portal-based modal
 * - WorkspaceDetail registered as a nested route via WorkspacesPage.routes()
 *
 * Parent context:
 * - Registered in the main routing configuration as a top-level page component
 * - Static properties (title, path, exact) consumed by the router setup
 * - routes() method defines nested route for detail view (/workspaces/:id)
 *
 * State management approach:
 * - Local state holds workspaces array and loading flag
 * - useEffect watches location.pathname to refetch when navigating back from detail view
 * - Modal visibility controlled by boolean flag (showCreateModal)
 * - Data flows down to WorkspacesList, which triggers refetch via onUpdate callback
 *
 * Key responsibilities:
 * - Fetch and cache workspace list data from API
 * - Render header with "Create Workspace" action button
 * - Toggle create modal and refresh list after successful creation
 * - Show loading spinner during initial data fetch
 * - Define routing structure for nested detail view
 */
import React, { useCallback, useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@humansignal/ui";
import { ApiContext } from "../../providers/ApiProvider";
import { Block, Elem } from "../../utils/bem";
import { Spinner } from "../../components/Spinner/Spinner";
import { WorkspacesList } from "./WorkspacesList";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";
import { WorkspaceDetail } from "./WorkspaceDetail";
import "./WorkspacesPage.scss";

export const WorkspacesPage = () => {
  const api = useContext(ApiContext);
  const location = useLocation();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  /**
   * Loads all workspaces from the API and updates component state.
   * Called on mount when pathname matches /workspaces, and after creating or updating workspaces.
   * Wrapped in useCallback to prevent unnecessary re-renders in child components.
   */
  const fetchWorkspaces = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.callApi("workspaces", {});

      if (response) {
        setWorkspaces(response || []);
      }
    } catch (error) {
      console.error("Failed to load workspaces:", error);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (location.pathname === "/workspaces") {
      fetchWorkspaces();
    }
  }, [location.pathname, fetchWorkspaces]);

  /**
   * Handles successful workspace creation by closing the modal and refreshing the workspace list.
   * Passed to CreateWorkspaceModal as onCreate callback.
   */
  const handleCreate = useCallback(async () => {
    setShowCreateModal(false);
    await fetchWorkspaces();
  }, [fetchWorkspaces]);

  return (
    <Block name="workspaces-page">
      <Elem name="header">
        <h1>Workspaces</h1>
        <Button onClick={() => setShowCreateModal(true)}>Create Workspace</Button>
      </Elem>

      <Elem name="content">
        {loading ? <Spinner /> : <WorkspacesList workspaces={workspaces} onUpdate={fetchWorkspaces} />}
      </Elem>

      {showCreateModal && (
        <CreateWorkspaceModal onClose={() => setShowCreateModal(false)} onCreate={handleCreate} />
      )}
    </Block>
  );
};

WorkspacesPage.title = "Workspaces";
WorkspacesPage.path = "/workspaces";
WorkspacesPage.exact = true;

WorkspacesPage.routes = () => [
  {
    title: WorkspaceDetail.title,
    path: WorkspaceDetail.path,
    exact: WorkspaceDetail.exact,
    component: WorkspaceDetail,
  },
];
