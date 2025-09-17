import { StorageProviderForm } from "@humansignal/app-common/blocks/StorageProviderForm";
import { ff } from "@humansignal/core";
import { Button } from "@humansignal/ui";
import { useAtomValue } from "jotai";
import { forwardRef, useCallback, useContext, useImperativeHandle } from "react";
import { Columns } from "../../../components";
import { confirm, modal } from "../../../components/Modal/Modal";
import { Spinner } from "../../../components/Spinner/Spinner";
import { ApiContext } from "../../../providers/ApiProvider";
import { projectAtom } from "../../../providers/ProjectProvider";
import { useStorageCard } from "./hooks/useStorageCard";
import { providers } from "./providers";
import { StorageCard } from "./StorageCard";
import { StorageForm } from "./StorageForm";

export const StorageSet = forwardRef(({ title, target, rootClass, buttonLabel }, ref) => {
  const api = useContext(ApiContext);
  const project = useAtomValue(projectAtom);
  // The useStorageCard hook now consolidates this
  // logic providing only the essential state needed by this component/

  const useNewStorageScreen = ff.isActive(ff.FF_NEW_STORAGES);

  const { storageTypes, storages, storagesLoaded, loading, loaded, fetchStorages } = useStorageCard(
    target,
    project?.id,
  );

  const showStorageFormModal = useCallback(
    (storage) => {
      const action = storage ? "Edit" : "Connect";
      const actionTarget = target === "export" ? "Target" : "Source";
      const title = `${action} ${actionTarget} Storage`;

      const modalRef = modal({
        title,
        closeOnClickOutside: false,
        style: { width: 960 },
        bare: useNewStorageScreen,
        onHidden: () => {
          // Reset state when modal is closed (including Escape key)
          // This ensures clean state for next modal open
        },
        body: useNewStorageScreen ? (
          <StorageProviderForm
            title={title}
            target={target}
            storage={storage}
            project={project.id}
            rootClass={rootClass}
            storageTypes={storageTypes}
            providers={providers}
            onSubmit={async () => {
              modalRef.close();
              fetchStorages();
            }}
            onHide={() => {
              // This will be called when the modal is closed via Escape key
              // The state reset is handled inside StorageProviderForm
            }}
          />
        ) : (
          <StorageForm
            target={target}
            storage={storage}
            project={project.id}
            rootClass={rootClass}
            storageTypes={storageTypes}
            onSubmit={async () => {
              await fetchStorages();
              modalRef.close();
            }}
          />
        ),
      });
    },
    [project, fetchStorages, target, rootClass],
  );

  const onEditStorage = useCallback(
    async (storage) => {
      showStorageFormModal(storage);
    },
    [showStorageFormModal],
  );

  // Expose showStorageFormModal to parent via ref
  useImperativeHandle(
    ref,
    () => ({
      openAddModal: () => showStorageFormModal(),
    }),
    [showStorageFormModal],
  );

  const onDeleteStorage = useCallback(
    async (storage) => {
      confirm({
        title: "Deleting storage",
        body: "This action cannot be undone. Are you sure?",
        buttonLook: "negative",
        onOk: async () => {
          const response = await api.callApi("deleteStorage", {
            params: {
              type: storage.type,
              pk: storage.id,
              target,
            },
          });

          if (response !== null) fetchStorages();
        },
      });
    },
    [fetchStorages],
  );

  return (
    <Columns.Column title={title}>
      <div className={rootClass.elem("controls")}>
        <Button onClick={() => showStorageFormModal()} disabled={loading} look="outlined" aria-label="Add storage">
          {buttonLabel}
        </Button>
      </div>

      {loading && !loaded ? (
        <div className={rootClass.elem("empty")}>
          <Spinner size={32} />
        </div>
      ) : storagesLoaded && storages.length === 0 ? null : (
        storages?.map?.((storage) => (
          <StorageCard
            key={storage.id}
            storage={storage}
            target={target}
            rootClass={rootClass}
            storageTypes={storageTypes}
            onEditStorage={onEditStorage}
            onDeleteStorage={onDeleteStorage}
          />
        ))
      )}
    </Columns.Column>
  );
});
