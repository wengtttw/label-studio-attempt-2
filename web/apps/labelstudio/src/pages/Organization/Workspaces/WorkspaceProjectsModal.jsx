import { useState, useEffect } from "react";
import { Button } from "@humansignal/ui";
import { modal } from "../../../components/Modal/Modal";
import { useModalControls } from "../../../components/Modal/ModalPopup";
import { Space } from "../../../components/Space/Space";
import { useAPI } from "../../../providers/ApiProvider";

export const WorkspaceProjectsModal = ({ workspaceId, onUpdated }) => {
  let state = { projects: [], selected: new Set() };

  return modal({
    title: "Assign projects",
    body: () => {
      const [, setTick] = useState(0);
      const api = useAPI();

      useEffect(() => {
        (async () => {
          // get all projects (returns org projects)
          const res = await api.callApi("projects");
          const list = res?.results ?? res ?? [];
          state.projects = list;
          // preselect those assigned to this workspace
          state.selected = new Set(list.filter((p) => p.workspace === workspaceId).map((p) => p.id));
          setTick((t) => t + 1);
        })();
      }, []);

      return (
        <div style={{ padding: 8, minWidth: 640 }}>
          <div>
            <h4>Projects</h4>
            <ul>
              {state.projects.map((p) => (
                <li key={p.id} style={{ marginBottom: 6 }}>
                  <label>
                    <input
                      type="checkbox"
                      checked={state.selected.has(p.id)}
                      onChange={(e) => {
                        if (e.target.checked) state.selected.add(p.id);
                        else state.selected.delete(p.id);
                        setTick((t) => t + 1);
                      }}
                    />
                    <span style={{ marginLeft: 8 }}>{p.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    },
    footer: () => {
      const ctrl = useModalControls();
      const api = useAPI();
      return (
        <Space align="end">
          <Button look="outlined" onClick={() => ctrl.hide()}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={async () => {
              const project_ids = Array.from(state.selected);
              await api.callApi("workspaceProjects", { params: { pk: workspaceId }, body: { project_ids } });
              onUpdated?.();
              ctrl.hide();
            }}
          >
            Save
          </Button>
        </Space>
      );
    },
    style: { width: 760 },
  });
};

export default WorkspaceProjectsModal;
