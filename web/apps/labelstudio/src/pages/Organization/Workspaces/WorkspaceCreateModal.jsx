import { useState } from "react";
import { Button } from "@humansignal/ui";
import { modal } from "../../../components/Modal/Modal";
import { useModalControls } from "../../../components/Modal/ModalPopup";
import { Space } from "../../../components/Space/Space";
import { useAPI } from "../../../providers/ApiProvider";

export const WorkspaceCreateModal = ({ onCreated }) => {
  // shared state object closed over by body/footer so they can access the same value
  const modalState = { title: "" };

  return modal({
    title: "Create workspace",
    body: () => {
      const [, setTick] = useState(0);
      const ctrl = useModalControls();

      const onChange = (e) => {
        modalState.title = e.target.value;
        // trigger re-render
        setTick((t) => t + 1);
      };

      return (
        <div style={{ padding: 8 }}>
          <div style={{ marginBottom: 8 }}>Title</div>
          <input
            autoFocus
            value={modalState.title}
            onChange={onChange}
            placeholder="Workspace title"
            style={{ width: "100%", padding: 8, boxSizing: "border-box" }}
          />
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
              const title = (modalState.title || "").trim();
              if (!title) return;
              try {
                await api.callApi("createWorkspace", { body: { title } });
                onCreated?.();
              } catch (e) {
                // ApiProvider shows errors
              }
              ctrl.hide();
            }}
          >
            Create
          </Button>
        </Space>
      );
    },
    style: { width: 560 },
  });
};

export default WorkspaceCreateModal;
