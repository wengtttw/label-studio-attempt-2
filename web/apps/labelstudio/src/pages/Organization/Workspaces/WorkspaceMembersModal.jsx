import { useState, useEffect } from "react";
import { Button } from "@humansignal/ui";
import { modal } from "../../../components/Modal/Modal";
import { useModalControls } from "../../../components/Modal/ModalPopup";
import { Space } from "../../../components/Space/Space";
import { useAPI } from "../../../providers/ApiProvider";

export const WorkspaceMembersModal = ({ workspaceId, onUpdated }) => {
  let state = { newUserId: "", members: [] };

  return modal({
    title: "Manage workspace members",
    body: () => {
      const [, setTick] = useState(0);
      const api = useAPI();

      useEffect(() => {
        (async () => {
          const res = await api.callApi("workspaceMembers", { params: { pk: workspaceId } });
          if (res && res.results) state.members = res.results;
          else state.members = res || [];
          setTick((t) => t + 1);
        })();
      }, []);

      return (
        <div style={{ padding: 8, minWidth: 560 }}>
          <div style={{ marginBottom: 8 }}>
            Add user by ID
            <input
              style={{ marginLeft: 8, padding: 6 }}
              value={state.newUserId}
              onChange={(e) => {
                state.newUserId = e.target.value;
                setTick((t) => t + 1);
              }}
            />
            <Button
              size="small"
              onClick={async () => {
                const id = parseInt(state.newUserId, 10);
                if (!id) return;
                await api.callApi("addWorkspaceMember", { params: { pk: workspaceId }, body: { user: id } });
                const res = await api.callApi("workspaceMembers", { params: { pk: workspaceId } });
                state.members = res.results || res || [];
                state.newUserId = "";
                setTick((t) => t + 1);
              }}
            >
              Add
            </Button>
          </div>
          <div>
            <h4>Members</h4>
            <ul>
              {state.members.map((m) => (
                <li key={m.id} style={{ marginBottom: 6 }}>
                  {m.user?.email || m.user}
                  <Button
                    look="outlined"
                    size="small"
                    style={{ marginLeft: 8 }}
                    onClick={async () => {
                      await api.callApi("removeWorkspaceMember", { params: { pk: workspaceId, member_pk: m.id } });
                      const res = await api.callApi("workspaceMembers", { params: { pk: workspaceId } });
                      state.members = res.results || res || [];
                      setTick((t) => t + 1);
                    }}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
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
    style: { width: 640 },
  });
};

export default WorkspaceMembersModal;
