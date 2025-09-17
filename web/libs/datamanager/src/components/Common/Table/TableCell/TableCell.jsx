import { tableCN } from "../TableContext";

export const TableCell = ({ mix, mod, ...props }) => {
  return <span {...props} className={tableCN.elem("cell").mod(mod).mix(mix).toString()} />;
};
TableCell.displayName = "TableCell";

export const TableCellContent = ({ mix, mod, ...props }) => {
  return <span {...props} className={tableCN.elem("cell-content").mod(mod).mix(mix).toString()} />;
};
TableCellContent.displayName = "TableCellContent";
