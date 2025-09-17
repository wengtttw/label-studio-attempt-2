import { buttonVariant, Space } from "@humansignal/ui";
import { Block } from "apps/labelstudio/src/utils/bem";
import { Link } from "react-router-dom";
import type { Page } from "../../types/Page";
import { EmptyList } from "./@components/EmptyList";

export const ModelsPage: Page = () => {
  return (
    <Block name="prompter">
      <EmptyList />
    </Block>
  );
};

ModelsPage.title = () => "Models";
ModelsPage.titleRaw = "Models";
ModelsPage.path = "/models";

ModelsPage.context = () => {
  return (
    <Space size="small">
      <Link to="/prompt/settings" className={buttonVariant({ size: "small" })}>
        Create Model
      </Link>
    </Space>
  );
};
