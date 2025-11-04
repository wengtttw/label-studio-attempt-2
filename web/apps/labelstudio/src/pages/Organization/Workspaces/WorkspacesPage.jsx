import { useCallback, useEffect, useState } from "react";
import { useAPI } from "../../../providers/ApiProvider";
import { Block, Elem } from "../../../utils/bem";
import { Spinner } from "../../../components";
import { Button } from "@humansignal/ui";
import { WorkspaceCreateModal } from "./WorkspaceCreateModal";
import { WorkspaceMembersModal } from "./WorkspaceMembersModal";
import { WorkspaceProjectsModal } from "./WorkspaceProjectsModal";
import "./WorkspacesPage.scss";

export const WorkspacesPage = () => {
  const api = useAPI();
  const [workspaces, setWorkspaces] = useState(null);

  const fetchWorkspaces = useCallback(async () => {
    const response = await api.callApi("workspaces");
    if (response && response.results) {
      setWorkspaces(response.results);
    } else if (response && Array.isArray(response)) {
      // In case API returns plain list
      setWorkspaces(response);
    }
  }, [api]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const onCreate = async () => {
    WorkspaceCreateModal({
      onCreated: () => fetchWorkspaces(),
    });
  };

  return (
    <Block name="workspaces-page">
      <Elem name="wrapper">
        {workspaces ? (
          <Elem name="list">
            <Elem name="header">
              <Elem name="column">Name</Elem>
              <Elem name="column">Organization</Elem>
              <Elem name="column">Created</Elem>
            </Elem>
            <Elem name="header-actions">
              <Button onClick={onCreate} size="small">
                Create workspace
              </Button>
            </Elem>
            <Elem name="body">
              {workspaces.map((ws) => (
                <Elem key={`ws-${ws.id}`} name="item">
                  <Elem name="field">{ws.title}</Elem>
                  <Elem name="field">{ws.organization}</Elem>
                  <Elem name="field">{new Date(ws.created_at).toLocaleString()}</Elem>
                  <Elem name="actions">
                    <Button size="small" onClick={() => WorkspaceMembersModal({ workspaceId: ws.id, onUpdated: () => fetchWorkspaces() })}>
                      Members
                    </Button>
                    <Button size="small" onClick={() => WorkspaceProjectsModal({ workspaceId: ws.id, onUpdated: () => fetchWorkspaces() })} style={{ marginLeft: 8 }}>
                      Assign projects
                    </Button>
                  </Elem>
                </Elem>
              ))}
            </Elem>
          </Elem>
        ) : (
          <Elem name="loading">
            <Spinner size={36} />
          </Elem>
        )}
      </Elem>
    </Block>
  );
};

export default WorkspacesPage;

WorkspacesPage.title = "Workspaces";
WorkspacesPage.path = "/workspaces";
