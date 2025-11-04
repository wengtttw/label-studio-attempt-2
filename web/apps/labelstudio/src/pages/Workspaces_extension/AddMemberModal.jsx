import React, { useContext, useState, useEffect, useRef } from "react";
import { Button, Select } from "@humansignal/ui";
import { ApiContext } from "../../providers/ApiProvider";
import { modal } from "../../components/Modal/Modal";
import { Block, Elem } from "../../utils/bem";

const AddMemberForm = ({ api, workspaceId, onSuccess, onCancel }) => {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [roleOverride, setRoleOverride] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.callApi("users", {});
        const userList = response.results || response || [];
        setUsers(userList);
      } catch (error) {
        console.error("Failed to fetch users:", error);
        alert("Failed to load users");
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [api]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedUserId) {
      alert("Please select a user");
      return;
    }

    setSubmitting(true);

    try {
      const body = { user_id: parseInt(selectedUserId) };
      if (roleOverride) {
        body.role_override = roleOverride;
      }

      await api.callApi("workspaceAddMember", {
        params: { pk: workspaceId },
        body,
      });

      onSuccess();
    } catch (error) {
      console.error("Failed to add member:", error);
      alert("Failed to add member to workspace");
    } finally {
      setSubmitting(false);
    }
  };

  const userOptions = users.map((user) => {
    const fullName = [user.first_name, user.last_name]
      .filter((n) => !!n)
      .join(" ")
      .trim();

    return {
      value: user.id.toString(),
      label: fullName ? `${user.email} (${fullName})` : user.email,
    };
  });

  const roleOptions = [
    { value: "", label: "No override (use organization role)" },
    { value: "owner", label: "Owner" },
    { value: "admin", label: "Admin" },
    // { value: "reviewer", label: "Reviewer" },  // Commented out - reviewer functionality removed
    { value: "annotator", label: "Annotator" },
  ];

  if (loading) {
    return <Block name="add-member-form">Loading users...</Block>;
  }

  return (
    <Block name="add-member-form">
      <form onSubmit={handleSubmit}>
        <Elem name="field">
          <label htmlFor="user-select">Select User *</label>
          <Select
            id="user-select"
            value={selectedUserId}
            onChange={(val) => setSelectedUserId(val)}
            options={userOptions}
            placeholder="Choose a user..."
            required
          />
        </Elem>

        <Elem name="field">
          <label htmlFor="role-select">Role Override</label>
          <Select
            id="role-select"
            value={roleOverride}
            onChange={(val) => setRoleOverride(val)}
            options={roleOptions}
          />
        </Elem>

        <Elem name="actions">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add Member"}
          </Button>
          <Button look="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Elem>
      </form>
    </Block>
  );
};

export const AddMemberModal = ({ workspaceId, onClose, onAdd }) => {
  const api = useContext(ApiContext);
  const modalInstanceRef = useRef(null);

  useEffect(() => {
    modalInstanceRef.current = modal({
      title: "Add Member to Workspace",
      style: { width: 480 },
      closeOnClickOutside: false,
      onHidden: onClose,
      body: () => (
        <AddMemberForm
          api={api}
          workspaceId={workspaceId}
          onSuccess={() => {
            modalInstanceRef.current?.close();
            setTimeout(() => {
              onAdd();
            }, 0);
          }}
          onCancel={() => modalInstanceRef.current?.close()}
        />
      ),
    });

    return () => {
      modalInstanceRef.current?.close();
    };
  }, [api, workspaceId, onAdd, onClose]);

  return null;
};
