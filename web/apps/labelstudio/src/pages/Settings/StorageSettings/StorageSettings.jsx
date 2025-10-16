import { Typography } from "@humansignal/ui";
import { useEffect, useRef } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { cn, Block, Elem } from "../../../utils/bem";
import { useCurrentUser } from "../../../providers/CurrentUser";
import { isInLicense, LF_CLOUD_STORAGE_FOR_MANAGERS } from "../../../utils/license-flags";
import { StorageSet } from "./StorageSet";

const isAllowCloudStorage = !isInLicense(LF_CLOUD_STORAGE_FOR_MANAGERS);

export const StorageSettings = () => {
  const rootClass = cn("storage-settings"); // TODO: Remove in the next BEM cleanup
  const history = useHistory();
  const location = useLocation();
  const sourceStorageRef = useRef();
  const { user: currentUser } = useCurrentUser();
  
  // Only allow admin/owner
  const isUserLoaded = currentUser && typeof currentUser.org_role === "string";
  const canAccessSettings = isUserLoaded && ["admin", "owner"].includes(currentUser.org_role);

  // Handle auto-open query parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get("open") === "source") {
      // Auto-trigger "Add Source Storage" modal
      setTimeout(() => {
        sourceStorageRef.current?.openAddModal();
      }, 100); // Small delay to ensure component is mounted

      // Clean URL by removing the query parameter
      history.replace(location.pathname);
    }
  }, [location, history]);

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

  return isAllowCloudStorage ? (
    <section className="max-w-[680px]">
      <Typography variant="headline" size="medium" className="mb-base">
        Cloud Storage
      </Typography>
      <Typography size="small" className="text-neutral-content-subtler mb-wider">
        Use cloud or database storage as the source for your labeling tasks or the target of your completed annotations.
      </Typography>

      <div className="grid grid-cols-2 gap-8">
        <StorageSet
          ref={sourceStorageRef}
          title="Source Cloud Storage"
          buttonLabel="Add Source Storage"
          rootClass={rootClass}
        />

        <StorageSet
          title="Target Cloud Storage"
          target="export"
          buttonLabel="Add Target Storage"
          rootClass={rootClass}
        />
      </div>
    </section>
  ) : null;
};

StorageSettings.title = "Cloud Storage";
StorageSettings.path = "/storage";
