import { render, screen } from "@testing-library/react";
import { OutlinerPanel } from "../OutlinerPanel";

// Mock the dependencies
jest.mock("../../../../utils/bem", () => ({
  Block: ({ children, ...props }: any) => (
    <div data-testid="block" {...props}>
      {children}
    </div>
  ),
  Elem: ({ children, ...props }: any) => (
    <div data-testid="elem" {...props}>
      {children}
    </div>
  ),
}));

jest.mock("../../PanelBase", () => ({
  PanelBase: ({ children, ...props }: any) => (
    <div data-testid="panel-base" {...props}>
      {children}
    </div>
  ),
}));

jest.mock("../OutlinerTree", () => ({
  OutlinerTree: ({ regions, footer }: any) => (
    <div data-testid="outliner-tree">{footer && <div data-testid="outliner-tree-footer">{footer}</div>}</div>
  ),
}));

jest.mock("../ViewControls", () => ({
  ViewControls: (props: any) => <div data-testid="view-controls" {...props} />,
}));

jest.mock("@humansignal/icons", () => ({
  IconInfo: ({ width, height }: { width: number; height: number }) => (
    <svg data-testid="icon-info" width={width} height={height} />
  ),
}));

jest.mock("@humansignal/ui", () => ({
  IconLsLabeling: ({ width, height }: { width: number; height: number }) => (
    <svg data-testid="icon-ls-labeling" width={width} height={height} />
  ),
}));

jest.mock("../../Components/EmptyState", () => ({
  EmptyState: ({ icon, header, description, learnMore }: any) => (
    <div data-testid="empty-state">
      <div data-testid="empty-state-icon">{icon}</div>
      <div data-testid="empty-state-header">{header}</div>
      <div data-testid="empty-state-description">{description}</div>
      {learnMore && (
        <a href={learnMore.href} data-testid={learnMore.testId} target="_blank" rel="noopener noreferrer">
          {learnMore.text}
        </a>
      )}
    </div>
  ),
}));

jest.mock("../../../../utils/docs", () => ({
  getDocsUrl: (path: string) => `https://docs.example.com/${path}`,
}));

// Mock observer
jest.mock("mobx-react", () => ({
  observer: (component: any) => component,
}));

describe("OutlinerPanel", () => {
  const mockRegions = {
    sort: "date",
    sortOrder: "asc",
    group: "manual",
    regions: [],
    filter: [],
    setSort: jest.fn(),
    setGrouping: jest.fn(),
    setFilteredRegions: jest.fn(),
  };

  const defaultProps = {
    regions: mockRegions,
    currentEntity: null,
    name: "outliner",
    title: "Outliner",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("OutlinerEmptyState", () => {
    it("renders the icon correctly", () => {
      const regionsWithNoData = {
        ...mockRegions,
        regions: [],
        filter: null,
      };

      render(<OutlinerPanel {...defaultProps} regions={regionsWithNoData} />);

      const icon = screen.getByTestId("icon-ls-labeling");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute("width", "24");
      expect(icon).toHaveAttribute("height", "24");
    });

    it("renders the header text correctly", () => {
      const regionsWithNoData = {
        ...mockRegions,
        regions: [],
        filter: null,
      };

      render(<OutlinerPanel {...defaultProps} regions={regionsWithNoData} />);

      expect(screen.getByTestId("empty-state-header")).toHaveTextContent("Labeled regions will appear here");
    });

    it("renders the description text correctly", () => {
      const regionsWithNoData = {
        ...mockRegions,
        regions: [],
        filter: null,
      };

      render(<OutlinerPanel {...defaultProps} regions={regionsWithNoData} />);

      const description = screen.getByTestId("empty-state-description");
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent("Start labeling and track your results");
      expect(description).toHaveTextContent("using this panel");
    });

    it("renders the learn more link with correct attributes", () => {
      const regionsWithNoData = {
        ...mockRegions,
        regions: [],
        filter: null,
      };

      render(<OutlinerPanel {...defaultProps} regions={regionsWithNoData} />);

      const learnMoreLink = screen.getByTestId("regions-panel-learn-more");
      expect(learnMoreLink).toBeInTheDocument();
      expect(learnMoreLink).toHaveAttribute("href", "https://docs.example.com/guide/labeling");
      expect(learnMoreLink).toHaveAttribute("target", "_blank");
      expect(learnMoreLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(learnMoreLink).toHaveTextContent("Learn more");
    });

    it("renders empty state when regions array is empty", () => {
      const regionsWithNoData = {
        ...mockRegions,
        regions: [],
        filter: null,
      };

      render(<OutlinerPanel {...defaultProps} regions={regionsWithNoData} />);

      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
      expect(screen.queryByTestId("outliner-tree")).not.toBeInTheDocument();
      expect(screen.queryByTestId("block")).not.toBeInTheDocument(); // No filters-info block
    });

    it("does not render empty state when regions exist", () => {
      const regionsWithData = {
        ...mockRegions,
        regions: [{ id: "1", type: "rectangle" }],
        filter: [{ id: "1", type: "rectangle" }],
      };

      render(<OutlinerPanel {...defaultProps} regions={regionsWithData} />);

      expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
      expect(screen.getByTestId("outliner-tree")).toBeInTheDocument();
    });
  });

  describe("Regions filtering states", () => {
    it("shows 'All regions hidden' message when all regions are filtered out", () => {
      const regionsAllHidden = {
        ...mockRegions,
        regions: [{ id: "1", type: "rectangle" }],
        filter: [], // All regions filtered out
      };

      render(<OutlinerPanel {...defaultProps} regions={regionsAllHidden} />);

      expect(screen.getByTestId("block")).toBeInTheDocument();
      expect(screen.getByTestId("icon-info")).toBeInTheDocument();
      const titleElem = screen.getAllByTestId("elem").find((elem) => elem.textContent === "All regions hidden");
      expect(titleElem).toBeInTheDocument();

      const descriptionElem = screen
        .getAllByTestId("elem")
        .find((elem) => elem.textContent === "Adjust or remove the filters to view");
      expect(descriptionElem).toBeInTheDocument();
    });

    it("shows hidden regions count in footer when some regions are filtered", () => {
      const regionsPartiallyFiltered = {
        ...mockRegions,
        regions: [
          { id: "1", type: "rectangle" },
          { id: "2", type: "polygon" },
          { id: "3", type: "ellipse" },
        ],
        filter: [{ id: "1", type: "rectangle" }], // 2 regions hidden
      };

      render(<OutlinerPanel {...defaultProps} regions={regionsPartiallyFiltered} />);

      expect(screen.getByTestId("outliner-tree")).toBeInTheDocument();
      const footer = screen.getByTestId("outliner-tree-footer");
      expect(footer).toBeInTheDocument();

      // Check for hidden regions count message
      expect(footer.textContent).toContain("There are 2 hidden regions");
      expect(footer.textContent).toContain("Adjust or remove filters to view");
    });

    it("shows singular form for single hidden region", () => {
      const regionsOneHidden = {
        ...mockRegions,
        regions: [
          { id: "1", type: "rectangle" },
          { id: "2", type: "polygon" },
        ],
        filter: [{ id: "1", type: "rectangle" }], // 1 region hidden
      };

      render(<OutlinerPanel {...defaultProps} regions={regionsOneHidden} />);

      const footer = screen.getByTestId("outliner-tree-footer");
      expect(footer.textContent).toContain("There is 1 hidden region");
      expect(footer.textContent).not.toContain("regions"); // Check singular form
    });

    it("does not show hidden regions footer when no regions are hidden", () => {
      const regionsNoneHidden = {
        ...mockRegions,
        regions: [
          { id: "1", type: "rectangle" },
          { id: "2", type: "polygon" },
        ],
        filter: [
          { id: "1", type: "rectangle" },
          { id: "2", type: "polygon" },
        ], // All regions shown
      };

      render(<OutlinerPanel {...defaultProps} regions={regionsNoneHidden} />);

      expect(screen.getByTestId("outliner-tree")).toBeInTheDocument();
      expect(screen.queryByTestId("outliner-tree-footer")).not.toBeInTheDocument();
    });
  });

  describe("Component integration", () => {
    it("renders ViewControls with correct props", () => {
      render(<OutlinerPanel {...defaultProps} regions={mockRegions} />);

      const viewControls = screen.getByTestId("view-controls");
      expect(viewControls).toBeInTheDocument();
    });

    it("renders PanelBase with correct props", () => {
      render(<OutlinerPanel {...defaultProps} regions={mockRegions} />);

      const panelBase = screen.getByTestId("panel-base");
      expect(panelBase).toBeInTheDocument();
    });
  });

  describe("Media time sorting", () => {
    it("supports mediaStartTime sorting option when media regions are present", () => {
      const regionsWithMediaTime = {
        ...mockRegions,
        sort: "mediaStartTime",
        regions: [
          { id: "1", type: "audioregion", start: 5.0, end: 10.0 },
          { id: "2", type: "audioregion", start: 2.0, end: 7.0 },
          { id: "3", type: "timelineregion", ranges: [{ start: 15, end: 20 }] },
          { id: "4", type: "timelineregion", ranges: [{ start: 8, end: 12 }] },
        ],
        filter: [
          { id: "1", type: "audioregion", start: 5.0, end: 10.0 },
          { id: "2", type: "audioregion", start: 2.0, end: 7.0 },
          { id: "3", type: "timelineregion", ranges: [{ start: 15, end: 20 }] },
          { id: "4", type: "timelineregion", ranges: [{ start: 8, end: 12 }] },
        ],
      };

      render(<OutlinerPanel {...defaultProps} regions={regionsWithMediaTime} />);

      const viewControls = screen.getByTestId("view-controls");
      expect(viewControls).toBeInTheDocument();
      expect(viewControls).toHaveAttribute("ordering", "mediaStartTime");
    });

    it("hides mediaStartTime sorting option when no media regions are present", () => {
      const regionsWithoutMediaTime = {
        ...mockRegions,
        sort: "date",
        regions: [
          { id: "1", type: "rectangle" },
          { id: "2", type: "polygon" },
          { id: "3", type: "ellipse" },
        ],
        filter: [
          { id: "1", type: "rectangle" },
          { id: "2", type: "polygon" },
          { id: "3", type: "ellipse" },
        ],
      };

      render(<OutlinerPanel {...defaultProps} regions={regionsWithoutMediaTime} />);

      const viewControls = screen.getByTestId("view-controls");
      expect(viewControls).toBeInTheDocument();
      expect(viewControls).toHaveAttribute("ordering", "date");
    });
  });
});
