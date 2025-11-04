import React, { useContext, useState, useEffect, useRef } from "react";
import { Button } from "@humansignal/ui";
import { ApiContext } from "../../providers/ApiProvider";
import { modal } from "../../components/Modal/Modal";
import { Block, Elem } from "../../utils/bem";

const RemoveMemberForm = ({ api, workspaceId, userId, userName, projectCount, onSuccess, onCancel }) => {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await api.callApi("workspaceRemoveMember", {
        params: { pk: workspaceId },
        body: {
          user_id: userId,
          cascade_to_projects: "remove",
        },
      });

      const projectsAffected = response?.projects_affected || 0;
      alert(`User removed from workspace. ${projectsAffected} project memberships affected.`);
      onSuccess();
    } catch (error) {
      console.error("Failed to remove member:", error);
      alert("Failed to remove member from workspace");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Block name="remove-member-form">
      <Elem name="warning">
        <p>
          You are about to remove <strong>{userName}</strong> from this workspace and all its projects.
        </p>
        {projectCount > 0 && (
          <p>
            This will affect <strong>{projectCount} project(s)</strong> in this workspace.
          </p>
        )}
      </Elem>

      <form onSubmit={handleSubmit}>
        <Elem name="actions">
          <Button type="submit" disabled={submitting} danger>
            {submitting ? "Removing..." : "Confirm Removal"}
          </Button>
          <Button look="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Elem>
      </form>
    </Block>
  );
};

export const RemoveMemberModal = ({ workspaceId, userId, userName, projectCount, onClose, onRemove }) => {
  const api = useContext(ApiContext);
  const modalInstanceRef = useRef(null);

  useEffect(() => {
    modalInstanceRef.current = modal({
      title: "Remove Member from Workspace",
      style: { width: 600 },
      closeOnClickOutside: false,
      onHidden: onClose,
      body: () => (
        <RemoveMemberForm
          api={api}
          workspaceId={workspaceId}
          userId={userId}
          userName={userName}
          projectCount={projectCount}
          onSuccess={() => {
            modalInstanceRef.current?.close();
            setTimeout(() => {
              onRemove();
            }, 0);
          }}
          onCancel={() => modalInstanceRef.current?.close()}
        />
      ),
    });

    return () => {
      modalInstanceRef.current?.close();
    };
  }, [api, workspaceId, userId, userName, projectCount, onRemove, onClose]);

  return null;
};
