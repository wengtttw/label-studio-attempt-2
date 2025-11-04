import React, { useContext, useState, useEffect, useRef } from "react";
import { Button } from "@humansignal/ui";
import { ApiContext } from "../../providers/ApiProvider";
import { modal } from "../../components/Modal/Modal";
import { Block, Elem } from "../../utils/bem";

const WorkspaceForm = ({ api, onSuccess, onCancel }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert("Workspace name is required");
      return;
    }

    setSubmitting(true);

    try {
      await api.callApi("createWorkspace", {
        body: {
          title: title.trim(),
          description: description.trim(),
        },
      });

      onSuccess();
    } catch (error) {
      console.error("Failed to create workspace:", error);
      alert("Failed to create workspace");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Block name="create-workspace-form">
      <form onSubmit={handleSubmit}>
        <Elem name="field">
          <label htmlFor="ws-title">Workspace Name *</label>
          <input
            id="ws-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Medical Imaging Projects"
            required
            autoFocus
          />
        </Elem>

        <Elem name="field">
          <label htmlFor="ws-desc">Description</label>
          <textarea
            id="ws-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={3}
          />
        </Elem>

        <Elem name="actions">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Workspace"}
          </Button>
          <Button look="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Elem>
      </form>
    </Block>
  );
};

export const CreateWorkspaceModal = ({ onClose, onCreate }) => {
  const api = useContext(ApiContext);
  const modalInstanceRef = useRef(null);

  useEffect(() => {
    modalInstanceRef.current = modal({
      title: "Create Workspace",
      style: { width: 480 },
      closeOnClickOutside: true,
      onHidden: onClose,
      body: () => (
        <WorkspaceForm
          api={api}
          onSuccess={() => {
            modalInstanceRef.current?.close();
            setTimeout(() => onCreate(), 0);
          }}
          onCancel={() => modalInstanceRef.current?.close()}
        />
      ),
    });

    return () => {
      modalInstanceRef.current?.close();
    };
  }, [api, onCreate, onClose]);

  return null;
};
