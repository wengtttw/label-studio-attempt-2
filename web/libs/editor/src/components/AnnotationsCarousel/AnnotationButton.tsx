import { useCallback, useEffect, useMemo, useState } from "react";
import { inject, observer } from "mobx-react";
import { useCopyText } from "@humansignal/core";
import { isDefined, userDisplayName } from "@humansignal/core/lib/utils/helpers";
import { Block, cn, Elem } from "../../utils/bem";
import {
  IconAnnotationGroundTruth,
  IconAnnotationSkipped2,
  IconDraftCreated2,
  IconDuplicate,
  IconLink,
  IconTrashRect,
  IconCommentResolved,
  IconCommentUnresolved,
  IconSparks,
  IconStar,
  IconStarOutline,
} from "@humansignal/icons";
import { Tooltip, Userpic, ToastType, useToast } from "@humansignal/ui";
import { TimeAgo } from "../../common/TimeAgo/TimeAgo";
import { useDropdown } from "../../common/Dropdown/DropdownTrigger";

// eslint-disable-next-line
// @ts-ignore
import { confirm } from "../../common/Modal/Modal";
import { type ContextMenuAction, ContextMenu, ContextMenuTrigger, type MenuActionOnClick } from "../ContextMenu";
import "./AnnotationButton.scss";

interface AnnotationButtonInterface {
  entity?: any;
  capabilities?: any;
  annotationStore?: any;
  store: any;
  onAnnotationChange?: () => void;
}

const renderCommentIcon = (ent: any) => {
  if (ent.unresolved_comment_count > 0) {
    return IconCommentUnresolved;
  }
  if (ent.comment_count > 0) {
    return IconCommentResolved;
  }

  return null;
};

const renderCommentTooltip = (ent: any) => {
  if (ent.unresolved_comment_count > 0) {
    return "Unresolved Comments";
  }
  if (ent.comment_count > 0) {
    return "All Comments Resolved";
  }

  return "";
};

const injector = inject(({ store }) => {
  return {
    store,
  };
});

export const AnnotationButton = observer(
  ({ entity, capabilities, annotationStore, onAnnotationChange }: AnnotationButtonInterface) => {
    const iconSize = 32;
    const isPrediction = entity.type === "prediction";
    const username = userDisplayName(
      entity.user ?? {
        firstName: entity.createdBy || "Admin",
      },
    );
    const [isGroundTruth, setIsGroundTruth] = useState<boolean>();
    const infoIsHidden = annotationStore.store?.hasInterface("annotations:hide-info");
    let hiddenUser = null;

    if (infoIsHidden) {
      // this data can be missing in tests, but we don't have `infoIsHidden` there, so hiding logic like this
      const currentUser = annotationStore.store.user;
      const isCurrentUser = entity.user?.id === currentUser.id || entity.createdBy === currentUser.email;
      hiddenUser = { email: isCurrentUser ? "Me" : "User" };
    }

    const CommentIcon = renderCommentIcon(entity);
    // need to find a more reliable way to grab this value
    // const historyActionType = annotationStore.history.toJSON()?.[0]?.actionType;

    useEffect(() => {
      setIsGroundTruth(entity.ground_truth);
    }, [entity, entity.ground_truth]);

    const clickHandler = useCallback(() => {
      const { selected, id, type } = entity;

      if (!selected) {
        if (type === "prediction") {
          annotationStore.selectPrediction(id);
        } else {
          annotationStore.selectAnnotation(id);
        }
      }
    }, [entity]);

    const AnnotationButtonContextMenu = injector(
      observer(({ entity, capabilities, store }: AnnotationButtonInterface) => {
        const annotationLink = useMemo(() => {
          const url = new URL(window.location.href);
          if (entity.pk) {
            url.searchParams.set("annotation", entity.pk);
          }
          // In case of targeting directly an annotation, we don't want to show the region in the URL
          // otherwise it will be shown as a region link
          url.searchParams.delete("region");
          return url.toString();
        }, [entity.pk]);
        const [copyLink] = useCopyText({ defaultText: annotationLink });
        const toast = useToast();
        const dropdown = useDropdown();
        const clickHandler = () => {
          onAnnotationChange?.();
          dropdown?.close();
        };
        const setGroundTruth = useCallback<MenuActionOnClick>(() => {
          entity.setGroundTruth(!isGroundTruth);
          clickHandler();
        }, [entity]);
        const duplicateAnnotation = useCallback<MenuActionOnClick>(() => {
          const c = annotationStore.addAnnotationFromPrediction(entity);

          window.setTimeout(() => {
            annotationStore.selectAnnotation(c.id);
            clickHandler();
          });
        }, [entity]);
        const linkAnnotation = useCallback<MenuActionOnClick>(() => {
          copyLink();
          dropdown?.close();
          toast.show({
            message: "Annotation link copied to clipboard",
            type: ToastType.info,
          });
        }, [entity, copyLink]);
        const deleteAnnotation = useCallback(() => {
          clickHandler();
          confirm({
            title: "Delete annotation?",
            body: (
              <>
                This will <strong>delete all existing regions</strong>. Are you sure you want to delete them?
                <br />
                This action cannot be undone.
              </>
            ),
            buttonLook: "destructive",
            okText: "Delete",
            onOk: () => {
              entity.list.deleteAnnotation(entity);
            },
          });
        }, [entity]);
        const isPrediction = entity.type === "prediction";
        const isDraft = !isDefined(entity.pk);
        const showGroundTruth = capabilities.groundTruthEnabled && !isPrediction && !isDraft;
        const showDuplicateAnnotation = capabilities.enableCreateAnnotation && !isDraft;
        const actions = useMemo<ContextMenuAction[]>(
          () => [
            {
              label: `${isGroundTruth ? "Unset " : "Set "} as Ground Truth`,
              onClick: setGroundTruth,
              icon: isGroundTruth ? (
                <IconStar color="#FFC53D" width={iconSize} height={iconSize} />
              ) : (
                <IconStarOutline width={iconSize} height={iconSize} />
              ),
              enabled: showGroundTruth,
            },
            {
              label: "Duplicate Annotation",
              onClick: duplicateAnnotation,
              icon: <IconDuplicate width={20} height={20} />,
              enabled: showDuplicateAnnotation,
            },
            {
              label: "Copy Annotation Link",
              onClick: linkAnnotation,
              icon: <IconLink />,
              enabled: !isDraft && store.hasInterface("annotations:copy-link"),
            },
            {
              label: "Delete Annotation",
              onClick: deleteAnnotation,
              icon: <IconTrashRect />,
              separator: true,
              danger: true,
              enabled: capabilities.enableAnnotationDelete && !isPrediction,
            },
          ],
          [
            entity,
            isGroundTruth,
            isPrediction,
            isDraft,
            capabilities.enableAnnotationDelete,
            capabilities.enableCreateAnnotation,
            capabilities.groundTruthEnabled,
          ],
        );

        return <ContextMenu actions={actions} />;
      }),
    );

    return (
      <Block name="annotation-button" mod={{ selected: entity.selected }}>
        <Elem name="mainSection" onClick={clickHandler}>
          <Elem name="picSection">
            <Elem
              name="userpic"
              tag={Userpic}
              showUsername
              username={isPrediction ? entity.createdBy : null}
              user={hiddenUser ?? entity.user ?? { email: entity.createdBy }}
              mod={{ prediction: isPrediction }}
              size={24}
            >
              {isPrediction && <IconSparks style={{ width: 18, height: 18 }} />}
            </Elem>
            {/* to do: return these icons when we have a better way to grab the history action type */}
            {/* {historyActionType === 'accepted' && <Elem name='status' mod={{ approved: true }}><IconCheckBold /></Elem>}
          {historyActionType && (
            <Elem name='status' mod={{ skipped: true }}>
              <IconCrossBold />
            </Elem>
          )}
          {entity.history.canUndo && (
            <Elem name='status' mod={{ updated: true }}>
              <IconCheckBold />
            </Elem>
          )} */}
          </Elem>
          <Elem name="main">
            <Elem name="user">
              <Elem tag="span" name="name">
                {hiddenUser ? hiddenUser.email : username}
              </Elem>
              {!infoIsHidden && (
                <Elem tag="span" name="entity-id">
                  #{entity.pk ?? entity.id}
                </Elem>
              )}
            </Elem>
            {!infoIsHidden && (
              <Elem name="info">
                <Elem name="date" component={TimeAgo} date={entity.createdDate} />
                {isPrediction && isDefined(entity.score) && (
                  <span title={`Prediction score = ${entity.score}`}>
                    {" · "} {(entity.score * 100).toFixed(2)}%
                  </span>
                )}
              </Elem>
            )}
          </Elem>
          {!isPrediction && (
            <Elem name="icons">
              {entity.draftId > 0 && (
                <Tooltip title="Draft">
                  <Elem name="icon" mod={{ draft: true }}>
                    <IconDraftCreated2 color="#617ADA" />
                  </Elem>
                </Tooltip>
              )}
              {entity.skipped && (
                <Tooltip title="Skipped">
                  <Elem name="icon" mod={{ skipped: true }}>
                    <IconAnnotationSkipped2 color="#DD0000" />
                  </Elem>
                </Tooltip>
              )}
              {isGroundTruth && (
                <Tooltip title="Ground-truth">
                  <Elem name="icon" mod={{ groundTruth: true }}>
                    <IconAnnotationGroundTruth />
                  </Elem>
                </Tooltip>
              )}
              {CommentIcon && (
                <Tooltip title={renderCommentTooltip(entity)}>
                  <Elem name="icon" mod={{ comments: true }}>
                    <CommentIcon />
                  </Elem>
                </Tooltip>
              )}
            </Elem>
          )}
        </Elem>
        <ContextMenuTrigger
          className={cn("annotation-button").elem("trigger").toClassName()}
          content={
            <AnnotationButtonContextMenu
              entity={entity}
              capabilities={capabilities}
              annotationStore={annotationStore}
            />
          }
        />
      </Block>
    );
  },
);
