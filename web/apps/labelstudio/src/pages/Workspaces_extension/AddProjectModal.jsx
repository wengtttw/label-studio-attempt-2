import React, { useContext, useState, useEffect, useRef } from "react";
import { Button } from "@humansignal/ui";
import { ApiContext } from "../../providers/ApiProvider";
import { modal } from "../../components/Modal/Modal";
import { Block, Elem } from "../../utils/bem";
import { Spinner } from "../../components/Spinner/Spinner";

const AddProjectForm = ({ api, workspaceId, existingProjectIds, onSuccess, onCancel }) => {
  const [projects, setProjects] = useState(null);
  const [selectedProjectIds, setSelectedProjectIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.callApi("projects", {
          params: {
            page_size: 1000,
            include: "id,title,description",
          },
        });

        if (response && response.results) {
          const availableProjects = response.results.filter(
            (project) => !existingProjectIds.includes(project.id)
          );
          setProjects(availableProjects);
        }
      } catch (error) {
        console.error("Failed to load projects:", error);
        alert("Failed to load projects");
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [api, existingProjectIds]);

  const handleToggleProject = (projectId) => {
    setSelectedProjectIds((prev) => {
      if (prev.includes(projectId)) {
        return prev.filter((id) => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (selectedProjectIds.length === 0) {
      alert("Please select at least one project");
      return;
    }

    setSubmitting(true);

    try {
      for (const projectId of selectedProjectIds) {
        await api.callApi("workspaceAddProject", {
          params: { pk: workspaceId },
          body: { project_id: projectId },
        });
      }

      onSuccess();
    } catch (error) {
      console.error("Failed to add projects:", error);
      alert(error?.response?.detail || "Failed to add projects");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Block name="add-project-form">
        <Elem name="loading">
          <Spinner size={36} />
        </Elem>
      </Block>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <Block name="add-project-form">
        <Elem name="empty">No available projects to add</Elem>
        <Elem name="actions">
          <Button look="outlined" onClick={onCancel}>
            Close
          </Button>
        </Elem>
      </Block>
    );
  }

  return (
    <Block name="add-project-form">
      <form onSubmit={handleSubmit}>
        <Elem name="field">
          <label>Select Projects *</label>
          <Elem name="project-list">
            {projects.map((project) => (
              <Elem
                key={project.id}
                name="project-item"
                mod={{ selected: selectedProjectIds.includes(project.id) }}
              >
                <input
                  type="checkbox"
                  id={`project-${project.id}`}
                  checked={selectedProjectIds.includes(project.id)}
                  onChange={() => handleToggleProject(project.id)}
                />
                <label htmlFor={`project-${project.id}`}>
                  <Elem name="project-title">{project.title}</Elem>
                  {project.description && (
                    <Elem name="project-description">{project.description}</Elem>
                  )}
                </label>
              </Elem>
            ))}
          </Elem>
          <small>
            Selected: {selectedProjectIds.length} project{selectedProjectIds.length !== 1 ? "s" : ""}
          </small>
        </Elem>

        <Elem name="actions">
          <Button type="submit" disabled={submitting || selectedProjectIds.length === 0}>
            {submitting ? "Adding..." : `Add ${selectedProjectIds.length} Project${selectedProjectIds.length !== 1 ? "s" : ""}`}
          </Button>
          <Button look="outlined" onClick={onCancel}>
            Cancel
          </Button>
        </Elem>
      </form>
    </Block>
  );
};

export const AddProjectModal = ({ workspaceId, existingProjectIds, onClose, onAdd }) => {
  const api = useContext(ApiContext);
  const modalInstanceRef = useRef(null);

  useEffect(() => {
    modalInstanceRef.current = modal({
      title: "Add Projects to Workspace",
      style: { width: 600 },
      closeOnClickOutside: true,
      onHidden: onClose,
      body: () => (
        <AddProjectForm
          api={api}
          workspaceId={workspaceId}
          existingProjectIds={existingProjectIds}
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
  }, [api, workspaceId, existingProjectIds, onAdd, onClose]);

  return null;
};
