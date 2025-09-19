import { format } from "date-fns";
import { NavLink } from "react-router-dom";
import { IconCross } from "@humansignal/icons";
import { Userpic, Button } from "@humansignal/ui";
import { Block, Elem } from "../../../utils/bem";
import { useQuery } from "@tanstack/react-query";
import { API } from "apps/labelstudio/src/providers/ApiProvider";
import "./SelectedUser.scss";
import { useEffect, useState } from "react";
import { useCurrentUserAtom } from "@humansignal/core/lib/hooks/useCurrentUser";

const UserProjectsLinks = ({ projects }) => {
  return (
    <Elem name="links-list">
      {projects.map((project) => (
        <Elem
          tag={NavLink}
          name="project-link"
          key={`project-${project.id}`}
          to={`/projects/${project.id}`}
          data-external
        >
          {project.title}
        </Elem>
      ))}
    </Elem>
  );
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Administrator" },
  { value: "annotator", label: "Annotator" },
  { value: "reviewer", label: "Reviewer" },
  { value: "inactive", label: "Inactive" },
];


export const SelectedUser = ({ user, onClose }) => {
  const fullName = [user.first_name, user.last_name]
    .filter((n) => !!n)
    .join(" ")
    .trim();

  // Get current logged in user info
  const { user: currentUser } = useCurrentUserAtom();

  // Fetch current user's org membership (to get their role)
  const { data: currentMembership } = useQuery({
    queryKey: [currentUser?.active_organization, currentUser?.id, "user-membership"],
    queryFn: async () => {
      if (!currentUser?.active_organization || !currentUser?.id) return null;
      return await API.invoke("userMemberships", {
        pk: currentUser.active_organization,
        userPk: currentUser.id,
      });
    },
    enabled: !!currentUser?.active_organization && !!currentUser?.id,
  });

  //Fetch organization member info for this user
  const { data: orgMember, error, isLoading, refetch: refetchOrgMember } = useQuery({
    queryKey: [user?.active_organization, user?.id, "user-membership"],
    queryFn: async () => {
      if (!user?.active_organization  || !user.id) return null;
      return await API.invoke("userMemberships", {
        pk: user.active_organization,
        userPk: user.id,
      });
    },
    enabled: !!user?.active_organization && !!user?.id,
  });

  console.log("Current membership role:", currentMembership?.role);
  console.log("orgMember data:", orgMember); // Debug orgMember data
  if (error) console.error("Error fetching orgMember:", error);

  // Only allow owner or admin to change roles
  const canChangeRole = currentMembership?.role === "owner" || currentMembership?.role === "admin";
  const isSelectedUserOwner = orgMember?.role?.toLowerCase() === "owner";
  const isSelectedCurrentUser = currentUser?.id === user?.id;
  const [selectedRole, setSelectedRole] = useState(orgMember?.role);
  const [pendingRole, setPendingRole] = useState(orgMember?.role);
  const [roleChangeStatus, setRoleChangeStatus] = useState(null);

  console.log("isSelectedUserOwner:", isSelectedUserOwner);
  console.log("isSelectedCurrentUser:", isSelectedCurrentUser);
  console.log("currentUser id:", currentUser?.id);
  console.log("user id:", user?.id);

  useEffect(() => {
    setSelectedRole(orgMember?.role);
    setPendingRole(orgMember?.role);
  }, [orgMember?.role]);

  const handleDropdownChange = (e) => {
    setPendingRole(e.target.value);
  };

const handleRoleUpdate = async () => {
  console.log("Role update triggered"); // Add this
  setRoleChangeStatus(null);
  try {
    const response = await fetch("/api/organizations/update-user-role/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // if using session authentication
      body: JSON.stringify({
        pk: user.active_organization,
        userPk: user.id,
        role: pendingRole,
      }),
    });
    if (!response.ok) throw new Error("Failed to update role");
    setRoleChangeStatus({ success: true, message: "Role updated successfully!" });
    setSelectedRole(pendingRole);
    await refetchOrgMember(); // Refetch the latest role from the backend
  } catch (err) {
    setRoleChangeStatus({ success: false, message: "Failed to update role." });
  }
};

  return (
    <Block name="user-info">
      <Button
        look="string"
        onClick={onClose}
        className="absolute top-[20px] right-[24px]"
        aria-label="Close user details"
      >
        <IconCross />
      </Button>

      <Elem name="header">
        <Userpic user={user} style={{ width: 64, height: 64, fontSize: 28 }} />
        <Elem name="info-wrapper">
          {fullName && <Elem name="full-name">{fullName}</Elem>}
          <Elem tag="p" name="email">
            {user.email}
          </Elem>
          {orgMember?.role && (
            <Elem tag="p" name="role">
              Role: {orgMember.role}
            </Elem>
          )}
          {/* Only show dropdown if current user is owner or admin */}
          {(canChangeRole && !isSelectedUserOwner && !isSelectedCurrentUser) && (
            <Elem name="section">
              <Elem name="section-title">Change Role</Elem>
              <select value={pendingRole} onChange={handleDropdownChange}>
                {ROLE_OPTIONS.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <button
                disabled={pendingRole === selectedRole}
                onClick={handleRoleUpdate}
                style={{ marginLeft: 8 }}
              >
                Update
              </button>
              {roleChangeStatus && (
                <div className={roleChangeStatus.success ? "success" : "error"}>
                  {roleChangeStatus.message}
                </div>
              )}
            </Elem>
          )}
          {!isLoading && !orgMember?.role && (
            <Elem tag="p" name="role">
              Role not found
            </Elem>
          )}
        </Elem>
      </Elem>

      {user.phone && (
        <Elem name="section">
          <a href={`tel:${user.phone}`}>{user.phone}</a>
        </Elem>
      )}

      {!!user.created_projects.length && (
        <Elem name="section">
          <Elem name="section-title">Created Projects</Elem>

          <UserProjectsLinks projects={user.created_projects} />
        </Elem>
      )}

      {!!user.contributed_to_projects.length && (
        <Elem name="section">
          <Elem name="section-title">Contributed to</Elem>

          <UserProjectsLinks projects={user.contributed_to_projects} />
        </Elem>
      )}

      <Elem tag="p" name="last-active">
        Last activity on: {format(new Date(user.last_activity), "dd MMM yyyy, KK:mm a")}
      </Elem>
    </Block>
  );
};
