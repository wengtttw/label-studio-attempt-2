import { format } from "date-fns";
import { NavLink } from "react-router-dom";
import { IconCross } from "@humansignal/icons";
import { Userpic, Button } from "@humansignal/ui";
import { Block, Elem } from "../../../utils/bem";
import { useQuery } from "@tanstack/react-query";
import { API } from "apps/labelstudio/src/providers/ApiProvider";
import "./SelectedUser.scss";
import { useState } from "react";

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

  //Fetch organization member info for this user
  const { data: orgMember, error, isLoading } = useQuery({
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

  console.log("orgMember data:", orgMember); // Debug orgMember data
  if (error) console.error("Error fetching orgMember:", error);

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
