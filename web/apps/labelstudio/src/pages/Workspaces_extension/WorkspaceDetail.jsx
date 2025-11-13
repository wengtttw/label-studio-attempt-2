/**
 * WorkspaceDetail displays a single workspace with tabbed views for projects and members.
 * Provides add/remove actions for both projects and members through modal dialogs.
 *
 * Dependencies:
 * - ApiContext provides callApi for fetching workspace data and removing projects
 * - react-router's useParams extracts workspace ID from URL (/workspaces/:id)
 * - useHistory enables back navigation and redirect on 404
 * - AddMemberModal, AddProjectModal, RemoveMemberModal handle respective operations
 * - BEM utilities structure layout with workspace-detail namespace
 *
 * Parent context:
 * - Registered as nested route under WorkspacesPage.routes()
 * - Route pattern: /:id(\d+) captures numeric workspace IDs
 * - Static properties (title, path, exact) consumed by router
 *
 * State management approach:
 * - Local state holds workspace object with projects and members arrays
 * - activeTab toggles between "projects" and "members" views
 * - Modal visibility flags (showAddMemberModal, showAddProjectModal, memberToRemove)
 * - fetchWorkspace called on mount and after any add/remove operation
 * - On 404 error, redirects back to /workspaces list page
 *
 * Key responsibilities:
 * - Fetch and display workspace details including title and description
 * - Render tabbed interface with project and member counts in tab labels
 * - Show lists of projects/members with remove buttons
 * - Manage lifecycle of add/remove modals
 * - Handle project removal with confirmation dialog
 * - Navigate back to workspace list or handle missing workspace
 */
import React, { useCallback, useContext, useEffect, useState } from "react";
import { useParams, useHistory } from "react-router-dom";
import { Button } from "@humansignal/ui";
import { ApiContext } from "../../providers/ApiProvider";
import { useCurrentUser } from "../../providers/CurrentUser";
import { ToastType, useToast } from "@humansignal/ui";
import { Block, Elem } from "../../utils/bem";
import { Spinner } from "../../components/Spinner/Spinner";
import { AddMemberModal } from "./AddMemberModal";
import { AddProjectModal } from "./AddProjectModal";
import { RemoveMemberModal } from "./RemoveMemberModal";
import "./WorkspaceDetail.scss";

export const WorkspaceDetail = () => {
  const api = useContext(ApiContext);
  const { id } = useParams();
  const history = useHistory();

  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("projects");
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const { user: currentUser } = useCurrentUser();
  const toast = useToast();

  const isUserLoaded = currentUser && typeof currentUser.org_role === "string";
  const canManageWorkspace = isUserLoaded && ["admin", "owner"].includes(currentUser.org_role);

  const fetchWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.callApi("workspaceDetail", {
        params: { pk: id },
      });

      if (response) {
        setWorkspace(response);
      }
    } catch (error) {
      console.error("Failed to load workspace:", error);
      if (error?.response?.status === 404 || error?.status === 404) {
        history.push("/workspaces");
      }
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const handleRemoveProject = async (projectId) => {
    if (isUserLoaded && !canManageWorkspace) {
      toast?.show({ type: ToastType.error, title: "Only organization admins and owners can remove projects from a workspace." });
      return;
    }
    if (!window.confirm("Remove this project from workspace?")) {
      return;
    }

    try {
      await api.callApi("workspaceRemoveProject", {
        params: { pk: id },
        body: { project_id: projectId },
      });
      await fetchWorkspace();
    } catch (error) {
      console.error("Failed to remove project:", error);
    }
  };

  const handleRemoveMember = (member) => {
    if (isUserLoaded && !canManageWorkspace) {
      toast?.show({ type: ToastType.error, title: "Only organization admins and owners can remove members from a workspace." });
      return;
    }

    setMemberToRemove(member);
  };

  if (loading) {
    return <Spinner />;
  }

  if (!workspace) {
    return <div>Workspace not found</div>;
  }

  return (
    <Block name="workspace-detail">
      <Elem name="header">
        <h1>{workspace.title}</h1>
        <Button look="outlined" onClick={() => history.push("/workspaces")}>
          Back to Workspaces
        </Button>
      </Elem>

      {workspace.description && <Elem name="description">{workspace.description}</Elem>}

      <Elem name="tabs">
        <Elem
          name="tab"
          mod={{ active: activeTab === "projects" }}
          onClick={() => setActiveTab("projects")}
        >
          Projects ({workspace.project_count || 0})
        </Elem>
        <Elem
          name="tab"
          mod={{ active: activeTab === "members" }}
          onClick={() => setActiveTab("members")}
        >
          Members ({workspace.member_count || 0})
        </Elem>
      </Elem>

      {activeTab === "projects" && (
        <Elem name="projects">
          <Elem name="section-header">
            <Button
              size="small"
              disabled={isUserLoaded && !canManageWorkspace}
              onClick={() => setShowAddProjectModal(true)}
            >
              Add Project
            </Button>
          </Elem>
          {workspace.projects && workspace.projects.length > 0 ? (
            workspace.projects.map((project) => (
              <Elem name="project-item" key={project.id}>
                <Elem name="project-info">
                  <Elem name="project-title">{project.title}</Elem>
                  <Elem name="project-description">{project.description}</Elem>
                </Elem>
                <Button
                  size="small"
                  danger
                  disabled={isUserLoaded && !canManageWorkspace}
                  onClick={() => handleRemoveProject(project.id)}
                >
                  Remove
                </Button>
              </Elem>
            ))
          ) : (
            <Elem name="empty">No projects in this workspace yet</Elem>
          )}
        </Elem>
      )}

      {activeTab === "members" && (
        <Elem name="members">
          <Elem name="section-header">
            <Button
              size="small"
              disabled={isUserLoaded && !canManageWorkspace}
              onClick={() => setShowAddMemberModal(true)}
            >
              Add Member
            </Button>
          </Elem>
          {workspace.members && workspace.members.length > 0 ? (
            workspace.members.map((member) => (
              <Elem name="member-item" key={member.id}>
                <Elem name="member-info">
                  <Elem name="member-name">
                    {member.user.first_name} {member.user.last_name}
                  </Elem>
                  <Elem name="member-email">{member.user.email}</Elem>
                  <Elem name="member-role">{member.effective_role}</Elem>
                </Elem>
                <Button
                  size="small"
                  danger
                  disabled={isUserLoaded && !canManageWorkspace}
                  onClick={() => handleRemoveMember(member)}
                >
                  Remove
                </Button>
              </Elem>
            ))
          ) : (
            <Elem name="empty">No members in this workspace yet</Elem>
          )}
        </Elem>
      )}

      {showAddMemberModal && (
        <AddMemberModal
          workspaceId={id}
          onClose={() => setShowAddMemberModal(false)}
          onAdd={async () => {
            setShowAddMemberModal(false);
            await fetchWorkspace();
          }}
        />
      )}

      {showAddProjectModal && (
        <AddProjectModal
          workspaceId={id}
          existingProjectIds={workspace?.projects?.map((p) => p.id) || []}
          onClose={() => setShowAddProjectModal(false)}
          onAdd={async () => {
            setShowAddProjectModal(false);
            await fetchWorkspace();
          }}
        />
      )}

      {memberToRemove && (
        <RemoveMemberModal
          workspaceId={id}
          userId={memberToRemove.user.id}
          userName={`${memberToRemove.user.first_name} ${memberToRemove.user.last_name} (${memberToRemove.user.email})`}
          projectCount={workspace?.project_count || 0}
          onClose={() => setMemberToRemove(null)}
          onRemove={async () => {
            setMemberToRemove(null);
            await fetchWorkspace();
          }}
        />
      )}
    </Block>
  );
};

WorkspaceDetail.title = "Workspace Details";
WorkspaceDetail.path = "/:id(\\d+)";
WorkspaceDetail.exact = true;
