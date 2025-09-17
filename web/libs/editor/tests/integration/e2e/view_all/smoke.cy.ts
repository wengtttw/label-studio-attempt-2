import { FF_DEV_3391 } from "@humansignal/frontend-test/feature-flags";
import { LabelStudio } from "@humansignal/frontend-test/helpers/LSF";
import { FF_LSDV_4583 } from "../../../../src/utils/feature-flags";
import { allTagsSampleData, configAllTags } from "../../data/view_all/smoke";

beforeEach(() => {
  LabelStudio.addFeatureFlagsOnPageLoad({
    [FF_DEV_3391]: true,
    [FF_LSDV_4583]: true,
  });
});

describe("View All Interactive - Smoke test", () => {
  it("Should render", () => {
    LabelStudio.params().config(configAllTags).data(allTagsSampleData).withResult([]).init();

    // @TODO: Check more things
  });
});
