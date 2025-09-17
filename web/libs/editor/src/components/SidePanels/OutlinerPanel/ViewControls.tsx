import {
  IconBoundingBox,
  IconClockTimeFourOutline,
  IconCursor,
  IconList,
  IconOutlinerEyeClosed,
  IconOutlinerEyeOpened,
  IconPredictions,
  IconSortDown,
  IconSortUp,
  IconTimelineRegion,
} from "@humansignal/icons";
import { Button } from "@humansignal/ui";
import { type FC, useCallback, useContext, useEffect, useMemo } from "react";
import { Dropdown } from "../../../common/Dropdown/Dropdown";
// eslint-disable-next-line
// @ts-ignore
import { Menu } from "../../../common/Menu/Menu";
import { BemWithSpecifiContext } from "../../../utils/bem";
import { SidePanelsContext } from "../SidePanelsContext";
import "./ViewControls.scss";
import { observer } from "mobx-react";
import { FF_DEV_3873, isFF } from "../../../utils/feature-flags";

const { Block, Elem } = BemWithSpecifiContext();

export type GroupingOptions = "manual" | "label" | "type";

export type OrderingOptions = "score" | "date" | "mediaStartTime";

export type OrderingDirection = "asc" | "desc";

interface ViewControlsProps {
  ordering: OrderingOptions;
  orderingDirection?: OrderingDirection;
  regions: any;
  onOrderingChange: (ordering: OrderingOptions) => void;
  onGroupingChange: (grouping: GroupingOptions) => void;
  onFilterChange: (filter: any) => void;
}

export const ViewControls: FC<ViewControlsProps> = observer(
  ({ ordering, regions, orderingDirection, onOrderingChange, onGroupingChange, onFilterChange }) => {
    const grouping = regions.group;
    const context = useContext(SidePanelsContext);

    // Check if any regions have media time information
    const hasMediaTimeRegions = useMemo(() => {
      return (
        regions.filteredRegions?.some((region) => {
          // Check for audio regions
          if (
            (region.type === "audioregion" || region.type === "timeseriesregion") &&
            typeof region.start === "number"
          ) {
            return true;
          }
          // Check for timeline regions (video)
          if (region.type === "timelineregion" && region.ranges && region.ranges.length > 0) {
            const firstRange = region.ranges[0];
            if (firstRange && typeof firstRange.start === "number") {
              return true;
            }
          }
          return false;
        }) ?? false
      );
    }, [regions.filteredRegions]);

    // Auto-fallback to "date" if current ordering is "mediaStartTime" but no media regions exist
    useEffect(() => {
      if (ordering === "mediaStartTime" && !hasMediaTimeRegions) {
        onOrderingChange("date");
      }
    }, [ordering, hasMediaTimeRegions, onOrderingChange]);

    const getGroupingLabels = useCallback((value: GroupingOptions): LabelInfo => {
      switch (value) {
        case "manual":
          return {
            label: (
              <>
                <IconList /> Group Manually
              </>
            ),
            selectedLabel: isFF(FF_DEV_3873) ? "Manual" : "Manual Grouping",
            icon: <IconList width={16} height={16} />,
            tooltip: "Manually Grouped",
          };
        case "label":
          return {
            label: (
              <>
                <IconBoundingBox /> Group by Label
              </>
            ),
            selectedLabel: isFF(FF_DEV_3873) ? "By Label" : "Grouped by Label",
            icon: <IconBoundingBox width={16} height={16} />,
            tooltip: "Grouped by Label",
          };
        case "type":
          return {
            label: (
              <>
                <IconCursor /> Group by Tool
              </>
            ),
            selectedLabel: isFF(FF_DEV_3873) ? "By Tool" : "Grouped by Tool",
            icon: <IconCursor width={16} height={16} />,
            tooltip: "Grouped by Tool",
          };
      }
    }, []);

    const getOrderingLabels = useCallback((value: OrderingOptions): LabelInfo => {
      switch (value) {
        case "date":
          return {
            label: (
              <>
                <IconClockTimeFourOutline /> Order by Time
              </>
            ),
            selectedLabel: "By Time",
            icon: <IconClockTimeFourOutline width={16} height={16} />,
          };
        case "score":
          return {
            label: (
              <>
                <IconPredictions /> Order by Score
              </>
            ),
            selectedLabel: "By Score",
            icon: <IconPredictions width={16} height={16} />,
          };
        case "mediaStartTime":
          return {
            label: (
              <>
                <IconTimelineRegion /> Order by Media Start Time
              </>
            ),
            selectedLabel: "By Media Start Time",
            icon: <IconTimelineRegion width={16} height={16} />,
          };
      }
    }, []);

    const renderOrderingDirectionIcon = orderingDirection === "asc" ? <IconSortUp /> : <IconSortDown />;

    return (
      <Block name="view-controls" mod={{ collapsed: context.locked }}>
        <Grouping
          value={grouping}
          options={["manual", "type", "label"]}
          onChange={(value) => onGroupingChange(value)}
          readableValueForKey={getGroupingLabels}
        />
        {grouping === "manual" && (
          <Elem name="sort">
            <Grouping
              value={ordering}
              direction={orderingDirection}
              options={hasMediaTimeRegions ? ["score", "date", "mediaStartTime"] : ["score", "date"]}
              onChange={(value) => onOrderingChange(value)}
              readableValueForKey={getOrderingLabels}
              allowClickSelected
              extraIcon={renderOrderingDirectionIcon}
              width={230}
            />
          </Elem>
        )}
        <ToggleRegionsVisibilityButton regions={regions} />
      </Block>
    );
  },
);

interface LabelInfo {
  label: string | React.ReactNode | JSX.Element;
  selectedLabel: string;
  icon: JSX.Element;
  tooltip?: string;
}

interface GroupingProps<T extends string> {
  value: T;
  options: T[];
  direction?: OrderingDirection;
  allowClickSelected?: boolean;
  onChange: (value: T) => void;
  readableValueForKey: (value: T) => LabelInfo;
  extraIcon?: JSX.Element;
  width?: number;
}

const Grouping = <T extends string>({
  value,
  options,
  direction,
  allowClickSelected,
  onChange,
  readableValueForKey,
  extraIcon,
  width = 200,
}: GroupingProps<T>) => {
  const readableValue = useMemo(() => {
    return readableValueForKey(value);
  }, [value]);

  const optionsList: [T, LabelInfo][] = useMemo(() => {
    return options.map((key) => [key, readableValueForKey(key)]);
  }, []);

  const dropdownContent = useMemo(() => {
    return (
      <Menu
        size="medium"
        style={{
          width,
          minWidth: width,
          borderRadius: isFF(FF_DEV_3873) && 4,
        }}
        selectedKeys={[value]}
        allowClickSelected={allowClickSelected}
      >
        {optionsList.map(([key, label]) => (
          <GroupingMenuItem
            key={key}
            name={key}
            value={value}
            direction={direction}
            label={label}
            onChange={(value) => onChange(value)}
          />
        ))}
      </Menu>
    );
  }, [value, optionsList, readableValue, direction, onChange]);

  return (
    <Dropdown.Trigger content={dropdownContent} style={{ width }}>
      <Button
        variant="neutral"
        size="smaller"
        data-testid={`grouping-${value}`}
        look="string"
        leading={readableValue.icon}
        trailing={
          isFF(FF_DEV_3873) ? (
            extraIcon
          ) : (
            <DirectionIndicator direction={direction} name={value} value={value} wrap={false} />
          )
        }
      >
        {readableValue.selectedLabel}
      </Button>
    </Dropdown.Trigger>
  );
};

interface GroupingMenuItemProps<T extends string> {
  name: T;
  label: LabelInfo;
  value: T;
  direction?: OrderingDirection;
  onChange: (key: T) => void;
}

const GroupingMenuItem = <T extends string>({ value, name, label, direction, onChange }: GroupingMenuItemProps<T>) => {
  return (
    <Menu.Item name={name} onClick={() => onChange(name)}>
      <Elem name="label">
        {label.label}
        <DirectionIndicator direction={direction} name={name} value={value} />
      </Elem>
    </Menu.Item>
  );
};

interface DirectionIndicator {
  direction?: OrderingDirection;
  value: string;
  name: string;
  wrap?: boolean;
}

const DirectionIndicator: FC<DirectionIndicator> = ({ direction, value, name, wrap = true }) => {
  const content = direction === "asc" ? <IconSortUp /> : <IconSortDown />;

  if (!direction || value !== name || isFF(FF_DEV_3873)) return null;
  if (!wrap) return content;

  return <span>{content}</span>;
};

interface ToggleRegionsVisibilityButton {
  regions: any;
}

const ToggleRegionsVisibilityButton = observer<FC<ToggleRegionsVisibilityButton>>(({ regions }) => {
  const toggleRegionsVisibility = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      regions.toggleVisibility();
    },
    [regions],
  );

  const isDisabled = !regions?.regions?.length;
  const isAllHidden = !isDisabled && regions.isAllHidden;

  return (
    <Button
      variant="neutral"
      size="smaller"
      look="string"
      disabled={isDisabled}
      onClick={toggleRegionsVisibility}
      aria-label={isAllHidden ? "Show all regions" : "Hide all regions"}
      tooltip={isAllHidden ? "Show all regions" : "Hide all regions"}
    >
      {isAllHidden ? (
        <IconOutlinerEyeClosed width={16} height={16} />
      ) : (
        <IconOutlinerEyeOpened width={16} height={16} />
      )}
    </Button>
  );
});
