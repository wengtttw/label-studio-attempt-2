import { type ChangeEvent, type FC, forwardRef, type KeyboardEvent, useCallback, useMemo, useState } from "react";
import { Block, Elem } from "../../utils/bem";
import { Select } from "@humansignal/ui";
import { WithHotkey } from "../Hotkey/WithHotkey";
import "./Pagination.scss";

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalPages: number;
  pageSizeOptions?: [];
  pageSizeSelectable: boolean;
  outline?: boolean;
  align?: "left" | "right";
  size?: "small" | "medium" | "large";
  noPadding?: boolean;
  hotkey?: {
    prev?: string;
    next?: string;
  };
  disabled?: boolean;
  onChange?: (pageNumber: number, maxPerPage?: number | string) => void;
}

const isSystemEvent = (e: KeyboardEvent<HTMLInputElement>): boolean => {
  return (
    e.code.match(/arrow/i) !== null ||
    (e.shiftKey && e.code.match(/arrow/i) !== null) ||
    e.metaKey ||
    e.ctrlKey ||
    e.code === "Backspace"
  );
};

export const Pagination: FC<PaginationProps> = forwardRef<any, PaginationProps>(
  (
    {
      size = "medium",
      pageSizeOptions = [1, 25, 50, 100],
      currentPage,
      pageSize,
      totalPages,
      outline = true,
      align = "right",
      noPadding = false,
      pageSizeSelectable = true,
      hotkey,
      disabled,
      onChange,
    },
    _ref,
  ) => {
    const [inputMode, setInputMode] = useState(false);

    const handleChangeSelect = (e: ChangeEvent<HTMLSelectElement>) => {
      onChange?.(1, e.currentTarget.value);
    };

    const options = useMemo(() => {
      return pageSizeOptions.map((obj: number, index: number) => {
        return {
          value: obj,
          label: `${obj} per page`,
        };
      });
    }, [pageSizeOptions]);

    return (
      <Block name="pagination" mod={{ size, outline, align, noPadding, disabled }}>
        <Elem name="navigation">
          <>
            <NavigationButton
              mod={["arrow-left", "arrow-left-double"]}
              onClick={() => onChange?.(1)}
              disabled={currentPage === 1 || disabled}
            />
            <Elem name="divider" />
          </>
          <NavigationButton
            mod={["arrow-left"]}
            onClick={() => onChange?.(currentPage - 1)}
            hotkey={hotkey?.prev}
            disabled={currentPage === 1 || disabled}
          />
          <Elem name="input">
            {inputMode ? (
              <input
                type="text"
                autoFocus
                defaultValue={currentPage}
                pattern="[0-9]"
                onKeyDown={(e) => {
                  const _value = Number.parseFloat(e.currentTarget.value);

                  if (e.code === "Escape") {
                    setInputMode(false);
                  } else if (e.code === "Enter") {
                    if (_value <= totalPages && _value >= 1) {
                      onChange?.(_value);
                    }

                    setInputMode(false);
                  } else if (e.code.match(/[0-9]/) === null && !isSystemEvent(e)) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onBlur={(e) => {
                  const _value = Number.parseFloat(e.currentTarget.value);

                  if (_value <= totalPages && _value >= 1) {
                    onChange?.(_value);
                  }

                  setInputMode(false);
                }}
              />
            ) : (
              <Elem
                name="page-indicator"
                onClick={() => {
                  setInputMode(true);
                }}
              >
                {currentPage} <span>of {totalPages}</span>
                <div
                  onClick={() => {
                    /*  */
                  }}
                />
              </Elem>
            )}
          </Elem>
          <NavigationButton
            mod={["arrow-right"]}
            onClick={() => onChange?.(currentPage + 1)}
            disabled={currentPage === totalPages || disabled}
            hotkey={hotkey?.next}
          />
          <>
            <Elem name="divider" />
            <NavigationButton
              mod={["arrow-right", "arrow-right-double"]}
              onClick={() => onChange?.(totalPages)}
              disabled={currentPage === totalPages || disabled}
            />
          </>
        </Elem>
        {pageSizeSelectable && (
          <Elem name="page-size">
            <Select value={pageSize} onChange={handleChangeSelect} options={options} />
          </Elem>
        )}
      </Block>
    );
  },
);

type NavigationButtonProps = {
  onClick: () => void;
  mod: string[];
  disabled?: boolean;
  hotkey?: string;
};

const NavigationButton: FC<NavigationButtonProps> = ({ mod, disabled, hotkey, onClick }) => {
  const buttonMod = Object.fromEntries(mod.map((m) => [m, true]));

  const actionHandler = useCallback(() => {
    if (!disabled) onClick();
  }, [disabled, onClick]);

  buttonMod.disabled = disabled === true;

  return (
    <WithHotkey binging={hotkey as HotkeyList}>
      <Elem name="btn" mod={buttonMod} onClick={actionHandler} />
    </WithHotkey>
  );
};
