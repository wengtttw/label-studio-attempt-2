import { useCallback, useEffect, useState } from "react";
import { useProject } from "../../providers/ProjectProvider";
import { useAPI } from "../../providers/ApiProvider";
import { cn, Block, Elem } from "../../utils/bem";
import { Typography } from "@humansignal/ui";
import { useCurrentUser } from "../../providers/CurrentUser";

import "./Membership.scss";
import { SelectedUser } from "./SelectedUser";

export const MembershipSettings = () => {
  const { project } = useProject();
  const api = useAPI();
  const [projectMembers, setProjectMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { user: currentUser } = useCurrentUser();

  // Only allow admin/owner
  const isUserLoaded = currentUser && typeof currentUser.org_role === "string";
  const canAccessSettings = isUserLoaded && ["admin", "owner"].includes(currentUser.org_role);

  // Fetch all users and project members
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [usersRes, membersRes] = await Promise.all([
        api.callApi("users", {}),
        api.callApi("projectMembers", { params: { pk: project.id } }),
      ]);
      setAllUsers(usersRes.results || usersRes || []);
      setProjectMembers(membersRes.results || membersRes || []);
    } catch (e) {
      setError("Failed to load users or members");
    } finally {
      setLoading(false);
    }
  }, [api, project.id]);

  useEffect(() => {
    if (project.id) fetchData();
  }, [project.id, fetchData]);

  // Users not in project
  const usersNotInProject = allUsers.filter(
    user => !projectMembers.some(member => member.user?.id === user.id)
  );

  // Users in project
  const usersInProject = projectMembers;

  // Select user handler
  const handleSelectUser = (user, isMember) => {
    let memberInfo = null;
    if (isMember) {
      memberInfo = usersInProject.find(m => m.user?.id === user.id);
    }
    setSelectedUser({ user, isMember, memberInfo });
  };

  const handleCloseSelectedUser = () => setSelectedUser(null);

  // Refresh data after action
  const handleUserAction = () => {
    setSelectedUser(null);
    fetchData();
  };

  if (!canAccessSettings) {
    return (
      <Block name="general-settings">
        <Elem name="wrapper">
          <h1>General Settings</h1>
          <Block name="settings-wrapper">
            <Typography size="large" color="danger">
              You do not have permission to access this page.
            </Typography>
          </Block>
        </Elem>
      </Block>
    );
  }

  return (
    <Block name="simple-settings">
      <Elem name="wrapper">
        <h1>Project Membership</h1>
        {error && <Elem name="error">{error}</Elem>}
        {loading ? (
          <Elem name="loading">Loading...</Elem>
        ) : (
          <Elem name="settings-wrapper">
            <Elem name="tables-row">
              <Elem name="table-wrapper">
                <h3>Users Not In Project</h3>
                <Elem tag="table" name="table" mod={{ type: 'not-in-project' }}>
                  <thead>
                    <Elem tag="tr" name="table-row" mod={{ head: true }}>
                      <Elem tag="th" name="table-head">Email</Elem>
                      <Elem tag="th" name="table-head">Name</Elem>
                      <Elem tag="th" name="table-head">Org Role</Elem>
                    </Elem>
                  </thead>
                  <tbody>
                    {usersNotInProject.map(user => (
                      <Elem
                        tag="tr"
                        name="table-row"
                        key={user.id}
                        onClick={() => handleSelectUser(user, false)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Elem tag="td" name="table-cell">{user.email}</Elem>
                        <Elem tag="td" name="table-cell">{user.first_name} {user.last_name}</Elem>
                        <Elem tag="td" name="table-cell">{user.org_role || 'N/A'}</Elem>
                      </Elem>
                    ))}
                  </tbody>
                </Elem>
              </Elem>
              <Elem name="table-wrapper">
                <h3>Users In Project</h3>
                <Elem tag="table" name="table" mod={{ type: 'in-project' }}>
                  <thead>
                    <Elem tag="tr" name="table-row" mod={{ head: true }}>
                      <Elem tag="th" name="table-head">Email</Elem>
                      <Elem tag="th" name="table-head">Name</Elem>
                      <Elem tag="th" name="table-head">Status</Elem>
                      <Elem tag="th" name="table-head">Org Role</Elem>
                    </Elem>
                  </thead>
                  <tbody>
                    {usersInProject.map(member => (
                      <Elem
                        tag="tr"
                        name="table-row"
                        key={member.id}
                        onClick={() => handleSelectUser(member.user, true)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Elem tag="td" name="table-cell">{member.user?.email}</Elem>
                        <Elem tag="td" name="table-cell">{member.user?.first_name} {member.user?.last_name}</Elem>
                        <Elem tag="td" name="table-cell">{member.enabled ? "Enabled" : "Disabled"}</Elem>
                        <Elem tag="td" name="table-cell">{member.user?.org_role || 'N/A'}</Elem>
                      </Elem>
                    ))}
                  </tbody>
                </Elem>
              </Elem>
            </Elem>
            {/* Selected user panel placeholder */}
            {selectedUser && (
              <SelectedUser
                user={selectedUser.user}
                isMember={selectedUser.isMember}
                memberInfo={selectedUser.memberInfo}
                onClose={handleCloseSelectedUser}
                onAction={handleUserAction}
              />
            )}
          </Elem>
        )}
      </Elem>
    </Block>
  );
};

MembershipSettings.title = "Membership Interface";
MembershipSettings.path = "/membership";