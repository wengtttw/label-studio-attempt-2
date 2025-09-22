import { useState } from "react";
import { Block, Elem } from "../../utils/bem";
import { useAPI } from "../../providers/ApiProvider";
import { useProject } from "../../providers/ProjectProvider";

export const SelectedUser = ({ user, isMember, memberInfo, onClose, onAction }) => {
  const api = useAPI();
  const { project } = useProject();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Actions: add, remove, enable, disable
  const handleAdd = async () => {
    setLoading(true);
    setError("");
    try {
      await api.callApi("addProjectMember", {
        params: { pk: project.id },
        body: { user: user.id },
      });
      onAction && onAction();
    } catch (e) {
      setError("Failed to add user");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    setError("");
    try {
      await api.callApi("removeProjectMember", {
        params: { pk: project.id, member_pk: memberInfo.id },
      });
      onAction && onAction();
    } catch (e) {
      setError("Failed to remove user");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    setLoading(true);
    setError("");
    try {
      await api.callApi("updateProjectMember", {
        params: { pk: project.id, member_pk: memberInfo.id },
        body: { enabled: !memberInfo.enabled },
      });
      onAction && onAction();
    } catch (e) {
      setError("Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Block name="selected-user-panel">
      <Elem name="header">
        <h3>Selected User</h3>
        <button onClick={onClose} style={{ float: "right" }}>Close</button>
      </Elem>
      <Elem name="body">
        <div>Email: {user.email}</div>
        <div>Name: {user.first_name} {user.last_name}</div>
        <div>Status: {isMember ? (memberInfo.enabled ? "Enabled" : "Disabled") : "Not in project"}</div>
        <div>Role: {isMember ? memberInfo.role : "-"}</div>
        {error && <Elem name="error">{error}</Elem>}
        {loading && <Elem name="loading">Processing...</Elem>}
        <div style={{ marginTop: 16 }}>
          {!isMember && (
            <button onClick={handleAdd}>Add to Project</button>
          )}
          {isMember && (
            <>
              <button onClick={handleToggle} style={{ marginRight: 8 }}>
                {memberInfo.enabled ? "Disable" : "Enable"}
              </button>
              <button onClick={handleRemove} style={{ color: "red" }}>
                Remove from Project
              </button>
            </>
          )}
        </div>
      </Elem>
    </Block>
  );
};
