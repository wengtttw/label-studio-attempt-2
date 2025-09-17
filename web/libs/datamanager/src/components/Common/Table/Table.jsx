import { observer } from "mobx-react";
import { createContext, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSDK } from "../../../providers/SDKProvider";
import { isDefined } from "../../../utils/utils";
import { Icon } from "../Icon/Icon";
import { modal } from "../Modal/Modal";
import { IconCode, IconGear, IconGearNewUI, IconCopyOutline } from "@humansignal/icons";
import { AutoSizerTable, Tooltip, Button } from "@humansignal/ui";
import { useCopyText } from "@humansignal/core";
import "./Table.scss";
import { TableCheckboxCell } from "./TableCheckbox";
import { tableCN, TableContext } from "./TableContext";
import { TableHead } from "./TableHead/TableHead";
import { TableRow } from "./TableRow/TableRow";
import { prepareColumns } from "./utils";
import { cn } from "../../../utils/bem";
import { FieldsButton } from "../FieldsButton";
import { FF_DEV_3873, FF_LOPS_E_3, isFF } from "../../../utils/feature-flags";

const Decorator = (decoration) => {
  return {
    get(col) {
      return decoration.find((d) => {
        let found = false;

        if (isDefined(d.alias)) {
          found = d.alias === col.alias;
        } else if (d.resolver instanceof Function) {
          found = d.resolver(col);
        }

        return found;
      });
    },
  };
};

export const Table = observer(
  ({
    view,
    data,
    cellViews,
    selectedItems,
    focusedItem,
    decoration,
    stopInteractions,
    onColumnResize,
    onColumnReset,
    headerExtra,
    ...props
  }) => {
    const colOrderKey = "dm:columnorder";
    const tableHead = useRef();
    const [colOrder, setColOrder] = useState(JSON.parse(localStorage.getItem(colOrderKey)) ?? {});
    const listRef = useRef();
    const Decoration = useMemo(() => Decorator(decoration), [decoration]);
    const { api, type } = useSDK();

    const headerCheckboxCell = useCallback(() => {
      return (
        <TableCheckboxCell
          checked={selectedItems.isAllSelected}
          indeterminate={selectedItems.isIndeterminate}
          onChange={() => props.onSelectAll()}
          className="select-all"
          ariaLabel={`${selectedItems.isAllSelected ? "Unselect" : "Select"} all rows`}
        />
      );
    }, [props.onSelectAll, selectedItems]);

    const rowCheckBoxCell = useCallback(
      ({ data }) => {
        const isChecked = selectedItems.isSelected(data.id);
        return (
          <TableCheckboxCell
            checked={isChecked}
            onChange={() => props.onSelectRow(data.id)}
            ariaLabel={`${isChecked ? "Unselect" : "Select"} Task ${data.id}`}
          />
        );
      },
      [props.onSelectRow, selectedItems],
    );

    const columns = prepareColumns(props.columns, props.hiddenColumns);

    columns.unshift({
      id: "select",
      headerClassName: "table__select-all",
      cellClassName: "select-row",
      style: {
        width: 40,
        maxWidth: 40,
        justifyContent: "center",
      },
      onClick: (e) => e.stopPropagation(),
      Header: headerCheckboxCell,
      Cell: rowCheckBoxCell,
    });

    columns.push({
      id: "show-source",
      cellClassName: "show-source",
      style: {
        width: 40,
        maxWidth: 40,
        justifyContent: "center",
      },
      onClick: (e) => e.stopPropagation(),
      Header() {
        return <div style={{ width: 40 }} />;
      },
      Cell({ data }) {
        let out = JSON.parse(data.source ?? "{}");

        out = {
          id: out?.id,
          data: out?.data,
          annotations: out?.annotations,
          predictions: out?.predictions,
        };

        const onTaskLoad = async () => {
          if (isFF(FF_LOPS_E_3) && type === "DE") {
            return new Promise((resolve) => resolve(out));
          }
          const response = await api.task({ taskID: out.id });

          return response ?? {};
        };

        return (
          <Button
            look="string"
            className="w-6 h-6 p-0 text-primary-content hover:text-primary-content-hover"
            onClick={() => {
              modal({
                title: `Source for task ${out?.id}`,
                style: { width: 800 },
                body: <TaskSourceView content={out} onTaskLoad={onTaskLoad} sdkType={type} />,
              });
            }}
            leading={<Icon icon={IconCode} />}
            tooltip="Show task source"
          />
        );
      },
    });

    if (Object.keys(colOrder).length > 0) {
      columns.sort((a, b) => {
        return colOrder[a.id] < colOrder[b.id] ? -1 : 1;
      });
    }
    useEffect(() => {
      localStorage.setItem(colOrderKey, JSON.stringify(colOrder));
    }, [colOrder]);

    const contextValue = {
      columns,
      data,
      cellViews,
    };

    const headerHeight = 43;

    const renderTableHeader = useCallback(
      ({ style }) => (
        <TableHead
          ref={tableHead}
          style={style}
          order={props.order}
          columnHeaderExtra={props.columnHeaderExtra}
          sortingEnabled={props.sortingEnabled}
          onSetOrder={props.onSetOrder}
          stopInteractions={stopInteractions}
          onTypeChange={props.onTypeChange}
          decoration={Decoration}
          onResize={onColumnResize}
          onReset={onColumnReset}
          extra={headerExtra}
          onDragEnd={(updatedColOrder) => setColOrder(updatedColOrder)}
        />
      ),
      [
        props.order,
        props.columnHeaderExtra,
        props.sortingEnabled,
        props.onSetOrder,
        props.onTypeChange,
        stopInteractions,
        view,
        view.selected.list,
        view.selected.all,
        tableHead,
      ],
    );

    const renderRow = useCallback(
      ({ style, index }) => {
        const row = data[index - 1];
        const isEven = index % 2 === 0;

        return (
          <TableRow
            key={row.id}
            data={row}
            even={isEven}
            onClick={(row, e) => props.onRowClick(row, e)}
            stopInteractions={stopInteractions}
            wrapperStyle={style}
            style={{
              height: props.rowHeight,
              width: props.fitContent ? "fit-content" : "auto",
            }}
            decoration={Decoration}
          />
        );
      },
      [
        data,
        props.fitContent,
        props.onRowClick,
        props.rowHeight,
        stopInteractions,
        selectedItems,
        view,
        view.selected.list,
        view.selected.all,
      ],
    );

    const isItemLoaded = useCallback(
      (index) => {
        return props.isItemLoaded(data, index);
      },
      [props, data],
    );

    const cachedScrollOffset = useRef();

    const initialScrollOffset = useCallback((height) => {
      if (isDefined(cachedScrollOffset.current)) {
        return cachedScrollOffset.current;
      }

      const { rowHeight: h } = props;
      const index = data.indexOf(focusedItem);

      if (index >= 0) {
        const scrollOffset = index * h - height / 2 + h / 2; // + headerHeight

        return (cachedScrollOffset.current = scrollOffset);
      }
      return 0;
    }, []);

    const itemKey = useCallback(
      (index) => {
        if (index > data.length - 1) {
          return index;
        }
        return data[index]?.key ?? index;
      },
      [data],
    );

    useEffect(() => {
      const listComponent = listRef.current?._listRef;

      if (listComponent) {
        listComponent.scrollToItem(data.indexOf(focusedItem), "center");
      }
    }, [data]);
    const tableWrapper = useRef();

    const right =
      tableWrapper.current?.firstChild?.firstChild.offsetWidth -
        tableWrapper.current?.firstChild?.firstChild?.firstChild.offsetWidth || 0;

    const columnsSelectorCN = cn("columns__selector");
    return (
      <>
        {view.root.isLabeling && (
          <div
            className={columnsSelectorCN.toString()}
            style={{
              right,
            }}
          >
            {isFF(FF_DEV_3873) ? (
              <FieldsButton
                className={columnsSelectorCN.elem("button-new").toString()}
                wrapper={FieldsButton.Checkbox}
                icon={<IconGearNewUI />}
                style={{ padding: "0" }}
                tooltip={"Customize Columns"}
              />
            ) : (
              <FieldsButton
                wrapper={FieldsButton.Checkbox}
                icon={<IconGear />}
                style={{
                  padding: 0,
                  zIndex: 1000,
                  borderRadius: 0,
                  height: "45px",
                  width: "45px",
                  margin: "-1px",
                }}
              />
            )}
          </div>
        )}
        <div ref={tableWrapper} className={tableCN.mod({ fit: props.fitToContent }).toString()}>
          <TableContext.Provider value={contextValue}>
            <StickyList
              ref={listRef}
              overscanCount={10}
              itemHeight={props.rowHeight}
              totalCount={props.total}
              itemCount={data.length + 1}
              itemKey={itemKey}
              innerElementType={innerElementType}
              stickyItems={[0]}
              stickyItemsHeight={[headerHeight]}
              stickyComponent={renderTableHeader}
              initialScrollOffset={initialScrollOffset}
              isItemLoaded={isItemLoaded}
              loadMore={props.loadMore}
            >
              {renderRow}
            </StickyList>
          </TableContext.Provider>
        </div>
      </>
    );
  },
);

const StickyListContext = createContext();

StickyListContext.displayName = "StickyListProvider";

const ItemWrapper = ({ data, index, style }) => {
  const { Renderer, stickyItems } = data;

  if (stickyItems?.includes(index) === true) {
    return null;
  }

  return <Renderer index={index} style={style} />;
};

const StickyList = observer(
  forwardRef((props, listRef) => {
    const {
      children,
      stickyComponent,
      stickyItems,
      stickyItemsHeight,
      totalCount,
      isItemLoaded,
      loadMore,
      initialScrollOffset,
      ...rest
    } = props;

    const itemData = {
      Renderer: children,
      StickyComponent: stickyComponent,
      stickyItems,
      stickyItemsHeight,
    };

    const itemSize = (index) => {
      if (stickyItems.includes(index)) {
        return stickyItemsHeight[index] ?? rest.itemHeight;
      }
      return rest.itemHeight;
    };

    return (
      <StickyListContext.Provider value={itemData}>
        <AutoSizerTable
          ref={listRef}
          totalCount={totalCount}
          loadMore={loadMore}
          isItemLoaded={isItemLoaded}
          itemData={itemData}
          itemSize={itemSize}
          initialScrollOffset={initialScrollOffset}
          className={tableCN.elem("auto-size").toString()}
          {...rest}
        >
          {ItemWrapper}
        </AutoSizerTable>
      </StickyListContext.Provider>
    );
  }),
);

StickyList.displayName = "StickyList";

const innerElementType = forwardRef(({ children, ...rest }, ref) => {
  return (
    <StickyListContext.Consumer>
      {({ stickyItems, stickyItemsHeight, StickyComponent }) => (
        <div ref={ref} {...rest}>
          {stickyItems.map((index) => (
            <StickyComponent
              className={tableCN.elem("sticky-header").toString()}
              key={index}
              index={index}
              style={{
                height: stickyItemsHeight[index],
                top: index * stickyItemsHeight[index],
              }}
            />
          ))}

          {children}
        </div>
      )}
    </StickyListContext.Consumer>
  );
});

const TaskSourceView = ({ content, onTaskLoad, sdkType }) => {
  const [source, setSource] = useState(content);

  useEffect(() => {
    onTaskLoad().then((response) => {
      const formatted = {
        id: response.id,
        data: response.data,
      };

      if (sdkType !== "DE") {
        formatted.annotations = response.annotations ?? [];
        formatted.predictions = response.predictions ?? [];
      }
      setSource(formatted);
    });
  }, []);

  const jsonString = useMemo(() => {
    return source ? JSON.stringify(source, null, 2) : "";
  }, [source]);

  const [handleCopy, copied] = useCopyText({ defaultText: jsonString });

  return (
    <div
      className="bg-neutral-surface rounded-small font-mono text-body-small leading-body-small overflow-auto max-h-[500px]"
      style={{ position: "relative" }}
    >
      <div style={{ padding: "16px", paddingTop: "16px" }}>
        <Tooltip title={copied ? "Copied!" : "Copy JSON"}>
          <Button
            look="string"
            variant="neutral"
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              width: 32,
              height: 32,
              padding: 0,
              zIndex: 10,
              color: "var(--color-neutral-content-subtle)",
            }}
            onClick={() => handleCopy()}
            leading={<Icon icon={IconCopyOutline} style={{ color: "var(--color-neutral-content-subtle)" }} />}
          />
        </Tooltip>
        <pre className="m-0 whitespace-pre-wrap break-words max-w-full" style={{ marginRight: "40px" }}>
          {jsonString}
        </pre>
      </div>
    </div>
  );
};
