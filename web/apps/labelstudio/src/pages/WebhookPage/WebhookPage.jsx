import { useCallback, useEffect, useMemo, useState } from "react";

import { useAPI } from "../../providers/ApiProvider";
import "./WebhookPage.scss";

import WebhookList from "./WebhookList";
import WebhookDetail from "./WebhookDetail";
import { useProject } from "../../providers/ProjectProvider";
import { cn, Block, Elem } from "../../utils/bem";
import { IconInfo } from "@humansignal/icons";
import { useHistory } from "react-router";
import { Typography } from "@humansignal/ui";
import { useCurrentUser } from "../../providers/CurrentUser";

const Webhook = () => {
  const { user: currentUser } = useCurrentUser();
  
  // Only allow admin/owner
  const isUserLoaded = currentUser && typeof currentUser.org_role === "string";
  const canAccessSettings = isUserLoaded && ["admin", "owner"].includes(currentUser.org_role);

  const [activeWebhook, setActiveWebhook] = useState(null);
  const [webhooks, setWebhooks] = useState(null);
  const [webhooksInfo, setWebhooksInfo] = useState(null);

  const history = useHistory();

  const api = useAPI();
  const { project } = useProject();

  const projectId = useMemo(() => {
    if (history.location.pathname.startsWith("/projects")) {
      if (Object.keys(project).length === 0) {
        return null;
      }
      return project.id;
    }
    return undefined;
  }, [project, history]);

  const fetchWebhooks = useCallback(async () => {
    if (projectId === null) {
      setWebhooks(null);
      return;
    }
    const params = {};

    if (projectId !== undefined) {
      params.project = projectId;
    } else {
      params.project = null;
    }
    const webhooks = await api.callApi("webhooks", {
      params,
    });

    if (webhooks) setWebhooks(webhooks);
  }, [projectId]);

  const fetchWebhooksInfo = useCallback(async () => {
    if (projectId === null) {
      setWebhooksInfo(null);
      return;
    }
    const params = {};

    if (projectId !== undefined) {
      params["organization-only"] = false;
    }

    const info = await api.callApi("webhooksInfo", {
      params,
    });

    if (info) setWebhooksInfo(info);
  }, [projectId]);

  useEffect(() => {
    fetchWebhooks();
    fetchWebhooksInfo();
  }, [project, projectId]);

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

  if (webhooks === null || webhooksInfo === null || projectId === null) {
    return null;
  }
  let content = null;

  if (activeWebhook === "new") {
    content = (
      <WebhookDetail
        onSelectActive={setActiveWebhook}
        onBack={() => setActiveWebhook(null)}
        webhook={null}
        fetchWebhooks={fetchWebhooks}
        webhooksInfo={webhooksInfo}
      />
    );
  } else if (activeWebhook === null) {
    content = (
      <WebhookList
        onSelectActive={setActiveWebhook}
        onAddWebhook={() => {
          setActiveWebhook("new");
        }}
        fetchWebhooks={fetchWebhooks}
        webhooks={webhooks}
      />
    );
  } else {
    content = (
      <WebhookDetail
        onSelectActive={setActiveWebhook}
        onBack={() => setActiveWebhook(null)}
        webhook={webhooks[webhooks.findIndex((x) => x.id === activeWebhook)]}
        fetchWebhooks={fetchWebhooks}
        webhooksInfo={webhooksInfo}
      />
    );
  }

  return (
    <Block name="webhook-wrap">
      {content}
      <Elem name="footer">
        <Elem name="footer-icon">
          <IconInfo width="28" height="28" />
        </Elem>
        <Elem name="footer-text">
          <p>
            Webhooks allow external services to be notified when certain events happen. When the specified events occur,
            a POST request is sent to each of the URLs you provide.
          </p>
          <p>
            <a href="https://labelstud.io/guide/webhooks.html" target="_blank" rel="noreferrer">
              Read more in the documentation
            </a>
            .
          </p>
        </Elem>
      </Elem>
    </Block>
  );
};

export const WebhookPage = {
  title: "Webhooks",
  path: "/webhooks",
  component: Webhook,
};
