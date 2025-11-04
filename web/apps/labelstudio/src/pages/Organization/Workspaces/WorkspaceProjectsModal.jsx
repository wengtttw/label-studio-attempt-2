import { useState, useEffect } from "react";
import { Button } from "@humansignal/ui";
import { modal } from "../../../components/Modal/Modal";
import { useModalControls } from "../../../components/Modal/ModalPopup";
import { Space } from "../../../components/Space/Space";
import { useAPI } from "../../../providers/ApiProvider";

export const WorkspaceProjectsModal = ({ workspaceId, onUpdated }) => {
  let state = { projects: [], selectedLeft: new Set(), selectedRight: new Set() };

  return modal({
    title: "Assign projects",
    body: () => {
      const [, setTick] = useState(0);
      const api = useAPI();

      useEffect(() => {
        (async () => {
          try {
            // get all projects (returns org projects)
            const res = await api.callApi("projects");
            const list = res?.results ?? res ?? [];
            // get current user id
            const me = await api.callApi("me");
            const userId = me?.id;

            // Filter to only projects where the current user is a project member with enabled === true
            const filtered = list.filter((p) => {
              if (!p.members || !Array.isArray(p.members)) return false;
              return p.members.some((m) => {
                const memberUserId = m.user?.id ?? m.user;
                return memberUserId === userId && m.enabled === true;
              });
            });

            state.projects = filtered;
            // preselect those assigned to this workspace
            state.selectedLeft = new Set();
            state.selectedRight = new Set(filtered.filter((p) => p.workspace === workspaceId).map((p) => p.id));
            setTick((t) => t + 1);
          } catch (err) {
            // swallow and leave empty list
            state.projects = [];
            state.selectedLeft = new Set();
            state.selectedRight = new Set();
            setTick((t) => t + 1);
          }
        })();
      }, []);

      return (
        <div style={{ padding: 8, minWidth: 760 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <h4>Available (yours, not in any workspace)</h4>
              <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid #eee', padding: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.projects
                      .filter((p) => !p.workspace)
                      .map((p) => (
                        <tr key={`left-${p.id}`} style={{ borderTop: '1px solid #f4f4f4' }}>
                          <td style={{ padding: 6, textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={state.selectedLeft.has(p.id)}
                              onChange={(e) => {
                                if (e.target.checked) state.selectedLeft.add(p.id);
                                else state.selectedLeft.delete(p.id);
                                setTick((t) => t + 1);
                              }}
                            />
                          </td>
                          <td style={{ padding: 6 }}>{p.title}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ width: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Button
                size="small"
                onClick={async () => {
                  const project_ids = Array.from(state.selectedLeft);
                  if (!project_ids.length) return;
                  try {
                    await api.callApi('workspaceProjects', { params: { pk: workspaceId }, body: { project_ids } });
                    // refresh
                    const res = await api.callApi('projects');
                    const list = res?.results ?? res ?? [];
                    // filter to enabled memberships like before
                    const me = await api.callApi('me');
                    const userId = me?.id;
                    const filtered = list.filter((p) => p.members && p.members.some((m) => (m.user?.id ?? m.user) === userId && m.enabled === true));
                    state.projects = filtered;
                    state.selectedLeft = new Set();
                    state.selectedRight = new Set();
                    setTick((t) => t + 1);
                    onUpdated?.();
                  } catch (err) {
                    // ApiProvider shows errors
                  }
                }}
              >
                Add →
              </Button>

              <div style={{ height: 16 }} />

              <Button
                size="small"
                look="outlined"
                onClick={async () => {
                  const project_ids = Array.from(state.selectedRight);
                  if (!project_ids.length) return;
                  try {
                    await api.callApi('workspaceUnassignProjects', { params: { pk: workspaceId }, body: { project_ids } });
                    // refresh
                    const res = await api.callApi('projects');
                    const list = res?.results ?? res ?? [];
                    const me = await api.callApi('me');
                    const userId = me?.id;
                    const filtered = list.filter((p) => p.members && p.members.some((m) => (m.user?.id ?? m.user) === userId && m.enabled === true));
                    state.projects = filtered;
                    state.selectedLeft = new Set();
                    state.selectedRight = new Set();
                    setTick((t) => t + 1);
                    onUpdated?.();
                  } catch (err) {
                    // ApiProvider shows errors
                  }
                }}
              >
                ← Remove
              </Button>
            </div>

            <div style={{ flex: 1 }}>
              <h4>In workspace</h4>
              <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid #eee', padding: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}></th>
                      <th>Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.projects
                      .filter((p) => p.workspace === workspaceId)
                      .map((p) => (
                        <tr key={`right-${p.id}`} style={{ borderTop: '1px solid #f4f4f4' }}>
                          <td style={{ padding: 6, textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={state.selectedRight.has(p.id)}
                              onChange={(e) => {
                                if (e.target.checked) state.selectedRight.add(p.id);
                                else state.selectedRight.delete(p.id);
                                setTick((t) => t + 1);
                              }}
                            />
                          </td>
                          <td style={{ padding: 6 }}>{p.title}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      );
    },
    footer: () => {
      const ctrl = useModalControls();
      return (
        <Space align="end">
          <Button look="outlined" onClick={() => ctrl.hide()}>
            Close
          </Button>
        </Space>
      );
    },
    style: { width: 760 },
  });
};

export default WorkspaceProjectsModal;
