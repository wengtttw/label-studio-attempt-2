import { Fragment, useCallback, useMemo, useState } from "react";
import sanitizeHtml from "sanitize-html";
import { IconSlack } from "@humansignal/icons";
import { Block, Elem } from "../../utils/bem";
import { absoluteURL, copyText } from "../../utils/helpers";
import { Button } from "@humansignal/ui";
import { Space } from "../Space/Space";
import "./Error.scss";

const SLACK_INVITE_URL = "https://slack.labelstud.io/?source=product-error-msg";

export const ErrorWrapper = ({
  title,
  message,
  errorId,
  stacktrace,
  validation,
  version,
  onGoBack,
  onReload,
  possum = false,
  minimal = false,
}) => {
  const preparedStackTrace = useMemo(() => {
    return (stacktrace ?? "").trim();
  }, [stacktrace]);

  const [copied, setCopied] = useState(false);

  const copyStacktrace = useCallback(() => {
    setCopied(true);
    copyText(preparedStackTrace);
    setTimeout(() => setCopied(false), 1200);
  }, [preparedStackTrace]);

  return (
    <Block name="error-message">
      {!minimal && possum !== false && (
        <Elem
          tag="img"
          name="heidi"
          src={absoluteURL("/static/images/opossum_broken.svg")}
          height="111"
          alt="Heidi's down"
        />
      )}

      {!minimal && title && <Elem name="title">{title}</Elem>}

      {!minimal && message && (
        <Elem
          name="detail"
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(String(message)),
          }}
        />
      )}

      {!minimal && preparedStackTrace && (
        <Elem
          name="stracktrace"
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(preparedStackTrace.replace(/(\n)/g, "<br>")),
          }}
        />
      )}

      {validation?.length > 0 && (
        <Elem tag="ul" name="validation">
          {validation.map(([field, errors]) => (
            <Fragment key={field}>
              {[].concat(errors).map((err, i) => (
                <Elem tag="li" key={i} name="message" dangerouslySetInnerHTML={{ __html: sanitizeHtml(err) }} />
              ))}
            </Fragment>
          ))}
        </Elem>
      )}

      {!minimal && (version || errorId) && (
        <Elem name="version">
          <Space>
            {version && `Version: ${version}`}
            {errorId && `Error ID: ${errorId}`}
          </Space>
        </Elem>
      )}

      {!minimal && (
        <Elem name="actions">
          <Space spread>
            <Elem tag={Button} name="action-slack" target="_blank" icon={<IconSlack />} href={SLACK_INVITE_URL}>
              Ask on Slack
            </Elem>

            <Space size="small">
              {preparedStackTrace && (
                <Button
                  disabled={copied}
                  onClick={copyStacktrace}
                  className="w-[100px]"
                  aria-label="Copy error stacktrace"
                >
                  {copied ? "Copied" : "Copy Stacktrace"}
                </Button>
              )}
              {onGoBack && (
                <Button onClick={onGoBack} aria-label="Go back">
                  Go Back
                </Button>
              )}
              {onReload && (
                <Button onClick={onReload} aria-label="Reload page">
                  Reload
                </Button>
              )}
            </Space>
          </Space>
        </Elem>
      )}
    </Block>
  );
};
