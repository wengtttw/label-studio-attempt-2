import { useCallback, useContext, useEffect, useState } from "react";
import { Divider } from "../../../components/Divider/Divider";
import { EmptyState, SimpleCard } from "@humansignal/ui";
import { IconPredictions, Typography, IconExternal } from "@humansignal/ui";
import { useAPI } from "../../../providers/ApiProvider";
import { ProjectContext } from "../../../providers/ProjectProvider";
import { Spinner } from "../../../components/Spinner/Spinner";
import { PredictionsList } from "./PredictionsList";
import { cn, Block, Elem } from "../../../utils/bem";
import { useCurrentUser } from "../../../providers/CurrentUser";

export const PredictionsSettings = () => {
  const api = useAPI();
  const { project } = useContext(ProjectContext);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
    const { user: currentUser } = useCurrentUser();
  
  // Only allow admin/owner
  const isUserLoaded = currentUser && typeof currentUser.org_role === "string";
  const canAccessSettings = isUserLoaded && ["admin", "owner"].includes(currentUser.org_role);

  const fetchVersions = useCallback(async () => {
    setLoading(true);
    const versions = await api.callApi("projectModelVersions", {
      params: {
        pk: project.id,
        extended: true,
      },
    });

    if (versions) setVersions(versions.static);
    setLoading(false);
    setLoaded(true);
  }, [project, setVersions]);

  useEffect(() => {
    if (project.id) {
      fetchVersions();
    }
  }, [project]);

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
    <section className="max-w-[42rem]">
      <Typography variant="headline" size="medium" className="mb-tight">
        Predictions
      </Typography>
      <div>
        {loading && <Spinner size={32} />}

        {loaded && versions.length > 0 && (
          <>
            <Typography variant="title" size="medium">
              Predictions List
            </Typography>
            <Typography size="small" className="text-neutral-content-subtler mt-base mb-wider">
              List of predictions available in the project. Each card is associated with a separate model version. To
              learn about how to import predictions,{" "}
              <a href="https://labelstud.io/guide/predictions.html" target="_blank" rel="noreferrer">
                see&nbsp;the&nbsp;documentation
              </a>
              .
            </Typography>
          </>
        )}

        {loaded && versions.length === 0 && (
          <SimpleCard title="" className="bg-primary-background border-primary-border-subtler p-base">
            <EmptyState
              size="medium"
              variant="primary"
              icon={<IconPredictions />}
              title="No predictions uploaded yet"
              description="Upload predictions to automatically prelabel your data and speed up annotation. Import predictions from multiple model versions to compare their performance, or connect live models from the Model page to generate predictions on demand."
              footer={
                !window.APP_SETTINGS?.whitelabel_is_active && (
                  <Typography variant="label" size="small" className="text-primary-link">
                    <a
                      href="https://labelstud.io/guide/predictions"
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid="predictions-help-link"
                      aria-label="Learn more about predictions (opens in new window)"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      Learn more
                      <IconExternal width={16} height={16} />
                    </a>
                  </Typography>
                )
              }
            />
          </SimpleCard>
        )}

        <PredictionsList project={project} versions={versions} fetchVersions={fetchVersions} />

        <Divider height={32} />
      </div>
    </section>
  );
};

PredictionsSettings.title = "Predictions";
PredictionsSettings.path = "/predictions";
