import { useState } from "react";
import { useCurrentUser } from "../../providers/CurrentUser";
import { Block, Elem } from "../../utils/bem";
import { useAPI } from "../../providers/ApiProvider";
import { useProject } from "../../providers/ProjectProvider";
import "./SelectedUser.scss";

export const SelectedUser = ({ user, isMember, memberInfo, onClose, onAction }) => {
  const api = useAPI();
  const { project } = useProject();
  const { user: currentUser } = useCurrentUser();
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
        params: { pk: project.id, userPk: memberInfo.id },
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
        params: { pk: project.id, userPk: memberInfo.id },
        body: { enabled: !memberInfo.enabled },
      });
      onAction && onAction();
    } catch (e) {
      setError("Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const isSelf = currentUser && user && currentUser.id === user.id;
  const isCreator = project && user && project.created_by_id === user.id;

  // Debug logs
  // console.log('SelectedUser debug:', {
  //   project,
  //   selectedUser: user,
  //   currentUser,
  //   created_by_id: project && project.created_by_id,
  //   isSelf,
  //   isCreator,
  // });

  return (
    <div className="user-info">
      <div className="user-info__header">
        <h3 className="user-info__full-name">Selected User</h3>
        <button onClick={onClose} style={{ float: "right" }}>Close</button>
      </div>
      <div className="user-info__section">
        <div className="user-info__email">Email: {user.email}</div>
        <div>Name: {user.first_name} {user.last_name}</div>
        <div>Status: {isMember ? (memberInfo.enabled ? "Enabled" : "Disabled") : "Not in project"}</div>
        <div>Org Role: {(memberInfo && memberInfo.org_role) || user.org_role || 'N/A'}</div>
        {error && <Elem name="error">{error}</Elem>}
        {loading && <Elem name="loading">Processing...</Elem>}
        <div style={{ marginTop: 16 }}>
          {!isMember && (
            <button onClick={handleAdd}>Add to Project</button>
          )}
          {isMember && (
            <>
              <button
                onClick={handleToggle}
                style={{ marginRight: 8 }}
                disabled={isSelf || isCreator}
                title={
                  isSelf
                    ? "You cannot disable yourself from the project."
                    : isCreator
                    ? "You cannot disable the project creator."
                    : undefined
                }
              >
                {memberInfo.enabled ? "Disable" : "Enable"}
              </button>
              <button
                onClick={handleRemove}
                style={{ color: "red" }}
                disabled={isSelf || isCreator}
                title={
                  isSelf
                    ? "You cannot remove yourself from the project."
                    : isCreator
                    ? "You cannot remove the project creator."
                    : undefined
                }
              >
                Remove from Project
              </button>
              {(isSelf || isCreator) && (
                <div style={{ color: 'gray', marginTop: 8, fontSize: 13 }}>
                  {isSelf
                    ? "You cannot remove or disable yourself from the project."
                    : "You cannot remove or disable the project creator from the project."}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
