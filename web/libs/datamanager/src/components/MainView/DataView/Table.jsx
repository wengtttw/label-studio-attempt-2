import { IconQuestionOutline } from "@humansignal/icons";
import { Tooltip } from "@humansignal/ui";
import { inject } from "mobx-react";
import { getRoot } from "mobx-state-tree";
import { useCallback, useMemo } from "react";
import { useShortcut } from "../../../sdk/hotkeys";
import { Block, Elem } from "../../../utils/bem";
import { FF_DEV_2536, isFF } from "../../../utils/feature-flags";
import * as CellViews from "../../CellViews";
import { Icon } from "../../Common/Icon/Icon";
import { Spinner } from "../../Common/Spinner";
import { Table } from "../../Common/Table/Table";
import { Tag } from "../../Common/Tag/Tag";
import { GridView } from "../GridView/GridView";
import "./Table.scss";
import { Button } from "@humansignal/ui";
import { useEffect, useState } from "react";
import { EmptyState } from "./empty-state";

const injector = inject(({ store }) => {
  const { dataStore, currentView } = store;
  const totalTasks = store.project?.task_count ?? store.project?.task_number ?? 0;
  const foundTasks = dataStore?.total ?? 0;

  const props = {
    store,
    dataStore,
    updated: dataStore.updated,
    view: currentView,
    viewType: currentView?.type ?? "list",
    columns: currentView?.fieldsAsColumns ?? [],
    hiddenColumns: currentView?.hiddenColumnsList,
    selectedItems: currentView?.selected,
    selectedCount: currentView?.selected?.length ?? 0,
    isLabeling: store.isLabeling ?? false,
    data: dataStore?.list ?? [],
    total: dataStore?.total ?? 0,
    isLoading: dataStore?.loading ?? true,
    isLocked: currentView?.locked ?? false,
    hasData: (store.project?.task_count ?? store.project?.task_number ?? dataStore?.total ?? 0) > 0,
    focusedItem: dataStore?.selected ?? dataStore?.highlighted,
    // Role-based empty state props
    role: store.SDK?.role ?? null,
    project: store.project ?? {},
    hasFilters: (currentView?.filtersApplied ?? 0) > 0,
    canLabel: totalTasks > 0 && foundTasks > 0,
  };

  return props;
});

export const DataView = injector(
  ({
    store,
    data,
    columns,
    view,
    selectedItems,
    dataStore,
    viewType,
    total,
    isLoading,
    isLabeling,
    hiddenColumns = [],
    hasData = false,
    isLocked,
    role,
    project,
    hasFilters,
    canLabel,
    ...props
  }) => {
    const [datasetStatusID, setDatasetStatusID] = useState(store.SDK.dataset?.status?.id);
    const focusedItem = useMemo(() => {
      return props.focusedItem;
    }, [props.focusedItem]);

    const loadMore = useCallback(async () => {
      if (!dataStore.hasNextPage || dataStore.loading) return Promise.resolve();

      await dataStore.fetch({ interaction: "scroll" });
      return Promise.resolve();
    }, [dataStore]);

    const isItemLoaded = useCallback(
      (data, index) => {
        const rowExists = index < data.length && !!data[index];
        const hasNextPage = dataStore.hasNextPage;

        return !hasNextPage || rowExists;
      },
      [dataStore.hasNextPage],
    );

    const columnHeaderExtra = useCallback(({ parent, original, help }, decoration) => {
      const children = [];

      if (parent) {
        children.push(
          <Tag
            key="column-type"
            color="blue"
            style={{
              fontWeight: "500",
              fontSize: 14,
              cursor: "pointer",
              width: 45,
              padding: 0,
            }}
          >
            {original?.readableType ?? parent.title}
          </Tag>,
        );
      }

      if (help && decoration?.help !== false) {
        children.push(
          <Tooltip key="help-tooltip" title={help}>
            <Icon icon={IconQuestionOutline} style={{ opacity: 0.5 }} />
          </Tooltip>,
        );
      }

      return children.length ? <>{children}</> : null;
    }, []);

    const onSelectAll = useCallback(() => view.selectAll(), [view]);

    const onRowSelect = useCallback((id) => view.toggleSelected(id), [view]);

    const onRowClick = useCallback(
      async (item, e) => {
        const itemID = item.task_id ?? item.id;

        if (store.SDK.type === "DE") {
          store.SDK.invoke("recordPreview", item, columns, getRoot(view).taskStore.associatedList);
        } else if (e.metaKey || e.ctrlKey) {
          window.open(`./?task=${itemID}`, "_blank");
        } else {
          store._sdk.lsf?.saveDraft();
          getRoot(view).startLabeling(item);
        }
      },
      [view, columns],
    );

    const renderContent = useCallback(
      (content) => {
        if (isLoading && total === 0 && !isLabeling) {
          return (
            <Block name="fill-container">
              <Spinner size="large" />
            </Block>
          );
        }
        if (store.SDK.type === "DE" && ["canceled", "failed"].includes(datasetStatusID)) {
          return (
            <Block name="syncInProgress">
              <Elem name="title" tag="h3">
                Failed to sync data
              </Elem>
              <Elem name="text">Check your storage settings. You may need to recreate this dataset</Elem>
            </Block>
          );
        }
        if (
          store.SDK.type === "DE" &&
          (total === 0 || data.length === 0 || !hasData) &&
          datasetStatusID === "completed"
        ) {
          return (
            <Block name="syncInProgress">
              <Elem name="title" tag="h3">
                Nothing found
              </Elem>
              <Elem name="text">Try adjusting the filter or similarity search parameters</Elem>
            </Block>
          );
        }
        if (store.SDK.type === "DE" && (total === 0 || data.length === 0 || !hasData)) {
          return (
            <Block name="syncInProgress">
              <Elem name="title" tag="h3">
                Hang tight! Records are syncing in the background
              </Elem>
              <Elem name="text">Press the button below to see any synced records</Elem>
              <Button
                size="small"
                look="outlined"
                onClick={async () => {
                  await store.fetchProject({
                    force: true,
                    interaction: "refresh",
                  });
                  await store.currentView?.reload();
                }}
              >
                Refresh
              </Button>
            </Block>
          );
        }
        // Unified empty state handling - EmptyState now handles all cases internally
        if (total === 0 || !hasData) {
          // Use unified EmptyState for all cases
          return (
            <Block name="no-results">
              <EmptyState
                // Import functionality props
                canImport={!!store.interfaces.get("import")}
                onOpenSourceStorageModal={() => getRoot(store)?.SDK?.invoke?.("openSourceStorageModal")}
                onOpenImportModal={() => getRoot(store)?.SDK?.invoke?.("importClicked")}
                // Role-based functionality props
                userRole={role}
                project={project}
                hasData={hasData}
                hasFilters={hasFilters}
                canLabel={canLabel}
                onLabelAllTasks={() => {
                  // Use the same logic as the main Label All Tasks button
                  // Set localStorage to indicate "label all" mode (same as main button)
                  localStorage.setItem("dm:labelstream:mode", "all");

                  // Start label stream mode (DataManager's equivalent of navigating to labeling)
                  store.startLabelStream();
                }}
                onClearFilters={() => {
                  // Clear all filters from the current view
                  const currentView = store.currentView;
                  if (currentView && currentView.filters) {
                    // Create a copy of the filters array to avoid modification during iteration
                    const filtersToDelete = [...currentView.filters];
                    filtersToDelete.forEach((filter) => {
                      currentView.deleteFilter(filter);
                    });
                    // Reload the view to refresh the data
                    currentView.reload();
                  }
                }}
              />
            </Block>
          );
        }

        return content;
      },
      [hasData, isLabeling, isLoading, total, datasetStatusID, role, project, hasFilters, canLabel],
    );

    const decorationContent = (col) => {
      const column = col.original;

      if (column.icon) {
        return <Tooltip title={column.help ?? col.title}>{column.icon}</Tooltip>;
      }

      return column.title;
    };

    const commonDecoration = useCallback(
      (alias, size, align = "flex-start", help = false) => ({
        alias,
        content: decorationContent,
        style: (col) => ({ width: col.width ?? size, justifyContent: align }),
        help,
      }),
      [],
    );

    const decoration = useMemo(
      () => [
        commonDecoration("total_annotations", 60, "center"),
        commonDecoration("cancelled_annotations", 60, "center"),
        commonDecoration("total_predictions", 60, "center"),
        commonDecoration("completed_at", 180, "space-between", true),
        commonDecoration("reviews_accepted", 60, "center"),
        commonDecoration("reviews_rejected", 60, "center"),
        commonDecoration("ground_truth", 60, "center"),
        isFF(FF_DEV_2536) && commonDecoration("comment_count", 60, "center"),
        isFF(FF_DEV_2536) && commonDecoration("unresolved_comment_count", 60, "center"),
        {
          resolver: (col) => col.type === "Number",
          style(col) {
            return /id/.test(col.id) ? { width: 50 } : { width: 110 };
          },
        },
        {
          resolver: (col) => col.type === "Image" && col.original && getRoot(col.original)?.SDK?.type !== "DE",
          style: { width: 150, justifyContent: "center" },
        },
        {
          resolver: (col) => col.type === "Image" && col.original && getRoot(col.original)?.SDK?.type === "DE",
          style: { width: 150 },
        },
        {
          resolver: (col) => ["Date", "Datetime"].includes(col.type),
          style: { width: 240 },
        },
        {
          resolver: (col) => ["Audio", "AudioPlus"].includes(col.type),
          style: { width: 150 },
        },
      ],
      [commonDecoration],
    );

    const content =
      view.root.isLabeling || viewType === "list" ? (
        <Table
          view={view}
          data={data}
          rowHeight={70}
          total={total}
          loadMore={loadMore}
          fitContent={isLabeling}
          columns={columns}
          hiddenColumns={hiddenColumns}
          cellViews={CellViews}
          decoration={decoration}
          order={view.ordering}
          focusedItem={focusedItem}
          isItemLoaded={isItemLoaded}
          sortingEnabled={view.type === "list"}
          columnHeaderExtra={columnHeaderExtra}
          selectedItems={selectedItems}
          onSelectAll={onSelectAll}
          onSelectRow={onRowSelect}
          onRowClick={onRowClick}
          stopInteractions={isLocked}
          onTypeChange={(col, type) => col.original.setType(type)}
          onColumnResize={(col, width) => {
            col.original.setWidth(width);
          }}
          onColumnReset={(col) => {
            col.original.resetWidth();
          }}
        />
      ) : (
        <GridView
          view={view}
          data={data}
          fields={columns}
          loadMore={loadMore}
          onChange={(id) => view.toggleSelected(id)}
          hiddenFields={hiddenColumns}
          stopInteractions={isLocked}
        />
      );

    useShortcut("dm.focus-previous", () => {
      if (document.activeElement !== document.body) return;

      const task = dataStore.focusPrev();

      getRoot(view).startLabeling(task);
    });

    useShortcut("dm.focus-next", () => {
      if (document.activeElement !== document.body) return;

      const task = dataStore.focusNext();

      getRoot(view).startLabeling(task);
    });

    useShortcut("dm.close-labeling", () => {
      if (document.activeElement !== document.body) return;

      if (dataStore.selected) store.closeLabeling();
    });

    useShortcut("dm.open-labeling", () => {
      if (document.activeElement !== document.body) return;

      const { highlighted } = dataStore;
      // don't close QuickView by Enter

      if (highlighted && !highlighted.isSelected) store.startLabeling(highlighted);
    });

    useEffect(() => {
      const updateDatasetStatus = (dataset) => dataset?.status?.id && setDatasetStatusID(dataset?.status?.id);

      getRoot(store).SDK.on("datasetUpdated", updateDatasetStatus);
      return () => getRoot(store).SDK.off("datasetUpdated", updateDatasetStatus);
    }, []);

    // Render the UI for your table
    return (
      <Block name="data-view-dm" className="dm-content" style={{ pointerEvents: isLocked ? "none" : "auto" }}>
        {renderContent(content)}
      </Block>
    );
  },
);
